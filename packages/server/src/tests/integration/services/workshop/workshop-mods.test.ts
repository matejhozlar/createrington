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

vi.mock("@/services/curseforge/mods", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/mods")>();
  return {
    ...actual,
    getMod: vi.fn(async () => {
      throw new Error("getMod must not be called in this suite");
    }),
    getMods: vi.fn(async () => []),
    searchMods: vi.fn(async () => []),
  };
});
vi.mock("@/services/curseforge/files", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/files")>();
  return {
    ...actual,
    getFilesDependencies: vi.fn(async () => []),
    getFilesDetails: vi.fn(async () => []),
  };
});
vi.mock("@/services/curseforge/modpack-manifest", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/curseforge/modpack-manifest")
    >();
  return {
    ...actual,
    getModpackModIds: vi.fn(async () => new Set<number>()),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  ingestProjects: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

import pool, { Q } from "@/db";
import { NotFoundError } from "@/app/middleware/error-handler";
import { workshopModService } from "@/services/workshop/mods.service";
import { ingestProject, ingestProjects } from "@/services/curseforge/ingest";
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
const USER_B = "999900000000000003";

const ctx = createWorkshopTestContext(990_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
  vi.mocked(ingestProject).mockImplementation(async (projectId: number) => ({
    entity: await Q.curseforge.project.get({ id: projectId }),
    data: makeProjectData(projectId),
  }));
  vi.mocked(ingestProjects).mockImplementation(
    async (projectIds: number[]) =>
      new Map(projectIds.map((id) => [id, makeProjectData(id)])),
  );
});

afterEach(async () => {
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("WorkshopModService.getWorkshopMods", () => {
  it("narrows to the requested statuses", async () => {
    const workshop = await seedWorkshop(ctx);
    const approved = await seedMod(ctx, workshop, { status: "approved" });
    const testing = await seedMod(ctx, workshop, { status: "testing" });
    await seedMod(ctx, workshop, { status: "pending" });
    await seedMod(ctx, workshop, {
      status: "rejected",
      rejectReason: "on_hold",
    });
    await seedMod(ctx, workshop, { status: "in_pack" });

    const mods = await workshopModService.getWorkshopMods(workshop.id, {
      statuses: ["approved", "testing", "next_update"],
    });

    expect(mods.map((mod) => mod.id).sort()).toEqual(
      [approved.id, testing.id].sort(),
    );
  });

  it("returns one mod in the listing shape", async () => {
    const workshop = await seedWorkshop(ctx);
    const depProjectId = await seedProject(ctx, "Lib");
    const mod = await seedMod(ctx, workshop, {
      status: "testing",
      fileId: 100,
    });
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );

    const item = await workshopModService.getWorkshopModListItem(mod.id);

    expect(item.id).toBe(mod.id);
    expect(item.project.id).toBe(mod.curseforgeProjectId);
    expect(item.dependencies).toMatchObject([
      { curseforgeProjectId: depProjectId, name: "Lib", coverage: "missing" },
    ]);
  });
});

describe("WorkshopModService.getRejectedMods", () => {
  it("returns rejected rows for an open workshop", async () => {
    const workshop = await seedWorkshop(ctx);
    const rejected = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "covered_by_other_mod",
      reviewedBy: ADMIN,
      reviewedAt: new Date(),
    });
    await seedMod(ctx, workshop, { submittedBy: USER_B });

    const rows = await workshopModService.getRejectedMods(workshop.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(rejected.id);
    expect(rows[0].rejectReason).toBe("covered_by_other_mod");
  });

  it("throws NotFoundError for a draft workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "draft" });

    await expect(
      workshopModService.getRejectedMods(workshop.id),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkshopModService.getMySuggestions", () => {
  it("returns the caller's own user rows across statuses", async () => {
    const workshop = await seedWorkshop(ctx);
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const approved = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const rejected = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
    });
    await seedMod(ctx, workshop, { submittedBy: USER_B });

    const rows = await workshopModService.getMySuggestions(workshop.id, USER_A);

    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [pending.id, approved.id, rejected.id].sort((a, b) => a - b),
    );
    expect(new Set(rows.map((row) => row.status))).toEqual(
      new Set(["pending", "approved", "rejected"]),
    );
  });
});

describe("WorkshopModService.getMySuggestionHistory", () => {
  it("returns the caller's rows across visible workshops, newest first", async () => {
    const first = await seedWorkshop(ctx);
    const second = await seedWorkshop(ctx, { status: "closed" });
    const older = await seedMod(ctx, first, { submittedBy: USER_A });
    const newer = await seedMod(ctx, second, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "incompatible",
    });
    await seedMod(ctx, first, { submittedBy: USER_B });

    const rows = await workshopModService.getMySuggestionHistory(USER_A);

    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect(rows[0]).toMatchObject({
      workshopName: second.name,
      workshopSlug: second.slug,
      status: "rejected",
    });
  });

  it("excludes suggestions in draft and archived workshops", async () => {
    const visible = await seedWorkshop(ctx);
    const draft = await seedWorkshop(ctx, { status: "draft" });
    const kept = await seedMod(ctx, visible, { submittedBy: USER_A });
    await seedMod(ctx, draft, { submittedBy: USER_A });

    const rows = await workshopModService.getMySuggestionHistory(USER_A);

    expect(rows.map((row) => row.id)).toEqual([kept.id]);
  });
});
