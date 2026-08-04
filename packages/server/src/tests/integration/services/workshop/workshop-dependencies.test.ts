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
    getModpackManifest: vi.fn(async () => ({
      version: null,
      modIds: new Set<number>(),
    })),
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
  seedPackMod,
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
  it("deletes a dependency row no pack member requires", async () => {
    const workshop = await seedWorkshop(ctx);
    const orphan = await seedPackMod(ctx, workshop, {
      origin: "dependency",
      addedBy: ADMIN,
    });

    await pruneOrphanedDependencies(workshop.modpackId);

    expect(await Q.modpack.mod.find({ id: orphan.id })).toBeNull();
  });

  it("keeps a dependency still required by another pack member", async () => {
    const workshop = await seedWorkshop(ctx);
    const depProjectId = await seedProject(ctx);
    const depRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      origin: "dependency",
      addedBy: ADMIN,
    });
    const first = await seedPackMod(ctx, workshop, { addedBy: ADMIN });
    const second = await seedPackMod(ctx, workshop, { addedBy: ADMIN });
    await seedRequiredDependency(
      workshop,
      first.curseforgeProjectId,
      depProjectId,
    );
    await seedRequiredDependency(
      workshop,
      second.curseforgeProjectId,
      depProjectId,
    );

    await Q.modpack.mod.delete({ id: first.id });
    await pruneOrphanedDependencies(workshop.modpackId);

    expect(await Q.modpack.mod.find({ id: depRow.id })).not.toBeNull();
  });

  it("collapses a dependency chain to a fixpoint", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectB = await seedProject(ctx);
    const projectC = await seedProject(ctx);
    const rowA = await seedPackMod(ctx, workshop, { addedBy: ADMIN });
    const rowB = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: projectB,
      origin: "dependency",
      addedBy: ADMIN,
    });
    const rowC = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: projectC,
      origin: "dependency",
      addedBy: ADMIN,
    });
    await seedRequiredDependency(workshop, rowA.curseforgeProjectId, projectB);
    await seedRequiredDependency(workshop, projectB, projectC);

    await Q.modpack.mod.delete({ id: rowA.id });
    await pruneOrphanedDependencies(workshop.modpackId);

    expect(await Q.modpack.mod.find({ id: rowB.id })).toBeNull();
    expect(await Q.modpack.mod.find({ id: rowC.id })).toBeNull();
  });

  it("never touches admin, suggestion, or live dependency rows", async () => {
    const workshop = await seedWorkshop(ctx);
    const adminRow = await seedPackMod(ctx, workshop, { addedBy: ADMIN });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const suggestionRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
    });
    const liveDep = await seedPackMod(ctx, workshop, {
      origin: "dependency",
      addedBy: ADMIN,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });

    await pruneOrphanedDependencies(workshop.modpackId);

    expect(await Q.modpack.mod.find({ id: adminRow.id })).not.toBeNull();
    expect(await Q.modpack.mod.find({ id: suggestionRow.id })).not.toBeNull();
    expect(await Q.modpack.mod.find({ id: liveDep.id })).not.toBeNull();
  });
});

describe("promoteRequiredDependencies via reviewMod approve", () => {
  it("creates a missing required dependency as a dependency-origin pack row", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );
    vi.mocked(getMods).mockResolvedValue([makeProjectData(depProjectId)]);

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    const pulled = await Q.modpack.mod.find({
      modpackId: workshop.modpackId,
      curseforgeProjectId: depProjectId,
    });
    expect(pulled).not.toBeNull();
    expect(pulled!.origin).toBe("dependency");
    expect(pulled!.workshopModId).toBeNull();
    expect(pulled!.addedBy).toBe(ADMIN);
    expect(pulled!.fileId).toBe(depProjectId + 1);
  });

  it("does not resurrect a dependency rejected in the workshop", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "incompatible",
    });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: depProjectId,
      }),
    ).toBeNull();
    expect(vi.mocked(getMods)).not.toHaveBeenCalled();
  });

  it("leaves a pending suggestion of the dependency to normal review", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      submittedBy: USER_A,
    });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: depProjectId,
      }),
    ).toBeNull();
    expect(vi.mocked(getMods)).not.toHaveBeenCalled();
  });
});
