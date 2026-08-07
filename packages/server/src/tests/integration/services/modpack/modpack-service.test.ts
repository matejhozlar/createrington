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
import { modpackService } from "@/services/modpack";
import { getModpackManifest } from "@/services/curseforge";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedMod,
  seedPackMod,
  seedProject,
} from "@/tests/helpers/workshop";

const USER_A = "999900000000000002";

const ctx = createWorkshopTestContext(992_000_000);

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

describe("ModpackService.reconcile", () => {
  it("heals a missing pack row for an approved suggestion", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
      fileId: 123,
      fileName: "healed.jar",
      fileReleaseType: 1,
    });

    await modpackService.reconcile(workshop.modpackId);

    const row = await Q.modpack.mod.find({
      modpackId: workshop.modpackId,
      curseforgeProjectId: mod.curseforgeProjectId,
    });
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
      fileId: 123,
      fileName: "healed.jar",
    });
  });

  it("marks members live from the manifest and imports stowaways", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const stowawayId = await seedProject(ctx);
    vi.mocked(getModpackManifest).mockResolvedValue({
      version: "2.0.0",
      modIds: new Set([member.curseforgeProjectId, stowawayId]),
    });

    await modpackService.reconcile(modpack.id);

    const live = await Q.modpack.mod.get({ id: member.id });
    expect(live.liveAt).not.toBeNull();
    expect(live.liveInVersion).toBe("2.0.0");
    expect(live.droppedFromManifestAt).toBeNull();

    const imported = await Q.modpack.mod.find({
      modpackId: modpack.id,
      curseforgeProjectId: stowawayId,
    });
    expect(imported).not.toBeNull();
    expect(imported).toMatchObject({
      origin: "import",
      workshopModId: null,
      liveInVersion: "2.0.0",
    });
    expect(imported!.liveAt).not.toBeNull();
  });

  it("flags dropped live members and deletes dropped import rows", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const adminRow = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const importRow = await seedPackMod(ctx, workshop, {
      origin: "import",
      addedBy: null,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue({
      version: "2.0.0",
      modIds: new Set<number>(),
    });

    await modpackService.reconcile(modpack.id);

    const dropped = await Q.modpack.mod.get({ id: adminRow.id });
    expect(dropped.liveAt).toBeNull();
    expect(dropped.liveInVersion).toBeNull();
    expect(dropped.droppedFromManifestAt).not.toBeNull();
    expect(await Q.modpack.mod.find({ id: importRow.id })).toBeNull();
  });

  it("clears the dropped flag when the mod ships again", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
      droppedFromManifestAt: new Date(),
    });
    vi.mocked(getModpackManifest).mockResolvedValue({
      version: "2.0.0",
      modIds: new Set([member.curseforgeProjectId]),
    });

    await modpackService.reconcile(modpack.id);

    const healed = await Q.modpack.mod.get({ id: member.id });
    expect(healed.droppedFromManifestAt).toBeNull();
    expect(healed.liveAt).not.toBeNull();
    expect(healed.liveInVersion).toBe("1.0.0");
  });

  it("does not import manifest mods that are known suggestions", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    vi.mocked(getModpackManifest).mockResolvedValue({
      version: "2.0.0",
      modIds: new Set([pending.curseforgeProjectId]),
    });

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: pending.curseforgeProjectId,
      }),
    ).toBeNull();
  });
});
