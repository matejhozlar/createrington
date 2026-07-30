import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";

vi.mock("@/services/workshop/discord", () => ({
  discordThreadUrl: vi.fn(
    (threadId: string) => `https://discord.com/channels/0/${threadId}`,
  ),
  listForumChannels: vi.fn(async () => []),
  assertForumChannel: vi.fn(async () => undefined),
  announceSuggestion: vi.fn(async () => undefined),
  announceReview: vi.fn(async () => undefined),
  announcePulledDependencies: vi.fn(async () => undefined),
  announceRemoval: vi.fn(async () => undefined),
  healThreads: vi.fn(async () => undefined),
}));

vi.mock("@/services/curseforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/curseforge")>();
  return {
    ...actual,
    getMod: vi.fn(async () => {
      throw new Error("getMod must not be called in this suite");
    }),
    getMods: vi.fn(async () => []),
    getModpackModIds: vi.fn(async () => new Set<number>()),
    searchMods: vi.fn(async () => []),
    getFilesDependencies: vi.fn(async () => []),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

import pool, { Q } from "@/db";
import { workshopService } from "@/services/workshop";
import { pruneOrphanedDependencies } from "@/services/workshop/dependencies";
import { getMods } from "@/services/curseforge";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedWorkshop,
  seedProject,
  seedMod,
  seedRequiredDependency,
  makeProjectData,
} from "@/tests/helpers/workshop";

const ADMIN = "999900000000000001";
const USER_A = "999900000000000002";

const ctx = createWorkshopTestContext(991_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
});

afterEach(async () => {
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("pruneOrphanedDependencies", () => {
  it("deletes an approved dependency row no approved mod requires", async () => {
    const workshop = await seedWorkshop(ctx);
    const orphan = await seedMod(ctx, workshop, {
      source: "dependency",
      status: "approved",
      submittedBy: ADMIN,
    });

    await pruneOrphanedDependencies(workshop.id);

    expect(await Q.workshop.mod.find({ id: orphan.id })).toBeNull();
  });

  it("keeps a dependency still required by another approved mod", async () => {
    const workshop = await seedWorkshop(ctx);
    const depProjectId = await seedProject(ctx);
    const depRow = await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      source: "dependency",
      status: "approved",
      submittedBy: ADMIN,
    });
    const first = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const second = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    await seedRequiredDependency(first.id, depProjectId);
    await seedRequiredDependency(second.id, depProjectId);

    await Q.workshop.mod.delete({ id: first.id });
    await pruneOrphanedDependencies(workshop.id);

    expect(await Q.workshop.mod.find({ id: depRow.id })).not.toBeNull();
  });

  it("collapses a dependency chain to a fixpoint", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectB = await seedProject(ctx);
    const projectC = await seedProject(ctx);
    const modA = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const modB = await seedMod(ctx, workshop, {
      curseforgeProjectId: projectB,
      source: "dependency",
      status: "approved",
      submittedBy: ADMIN,
    });
    const modC = await seedMod(ctx, workshop, {
      curseforgeProjectId: projectC,
      source: "dependency",
      status: "approved",
      submittedBy: ADMIN,
    });
    await seedRequiredDependency(modA.id, projectB);
    await seedRequiredDependency(modB.id, projectC);

    await Q.workshop.mod.delete({ id: modA.id });
    await pruneOrphanedDependencies(workshop.id);

    expect(await Q.workshop.mod.find({ id: modB.id })).toBeNull();
    expect(await Q.workshop.mod.find({ id: modC.id })).toBeNull();
  });

  it("never touches admin, user, or rejected dependency rows", async () => {
    const workshop = await seedWorkshop(ctx);
    const adminRow = await seedMod(ctx, workshop, {
      source: "admin",
      status: "approved",
      submittedBy: ADMIN,
    });
    const userRow = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const rejectedDep = await seedMod(ctx, workshop, {
      source: "dependency",
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: ADMIN,
    });

    await pruneOrphanedDependencies(workshop.id);

    expect(await Q.workshop.mod.find({ id: adminRow.id })).not.toBeNull();
    expect(await Q.workshop.mod.find({ id: userRow.id })).not.toBeNull();
    expect(await Q.workshop.mod.find({ id: rejectedDep.id })).not.toBeNull();
  });
});

describe("promoteRequiredDependencies via reviewMod approve", () => {
  it("creates a missing required dependency as an approved dependency row", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(mod.id, depProjectId);
    vi.mocked(getMods).mockResolvedValue([makeProjectData(depProjectId)]);

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    const pulled = await Q.workshop.mod.find({
      workshopId: workshop.id,
      curseforgeProjectId: depProjectId,
    });
    expect(pulled).not.toBeNull();
    expect(pulled!.source).toBe("dependency");
    expect(pulled!.status).toBe("approved");
    expect(pulled!.submittedBy).toBe(ADMIN);
    expect(pulled!.reviewedBy).toBe(ADMIN);
    expect(pulled!.fileId).toBe(depProjectId + 1);
  });

  it("does not resurrect a dependency rejected in the workshop", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(mod.id, depProjectId);
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      source: "dependency",
      status: "rejected",
      rejectReason: "incompatible",
      submittedBy: ADMIN,
    });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    const rows = await Q.workshop.mod.findAll({
      workshopId: workshop.id,
      curseforgeProjectId: depProjectId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("rejected");
    expect(vi.mocked(getMods)).not.toHaveBeenCalled();
  });
});
