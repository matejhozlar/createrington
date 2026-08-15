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
  announcePackDropOut: vi.fn(async () => undefined),
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
      fileId: 1,
      displayName: null,
      version: null,
      minecraftVersion: null,
      modLoader: null,
      publishedAt: null,
      entries: [],
      modIds: new Set<number>(),
    })),
    getModpackModIds: vi.fn(async () => new Set<number>()),
    searchMods: vi.fn(async () => []),
    getFilesDependencies: vi.fn(async () => []),
    getFilesDetails: vi.fn(async () => []),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  ingestProjects: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

import pool, { Q } from "@/db";
import { BadRequestError } from "@/app/middleware/error-handler";
import { modpackService } from "@/services/modpack";
import { workshopService } from "@/services/workshop";
import {
  getFilesDetails,
  getModpackManifest,
  type ModpackManifest,
} from "@/services/curseforge";
import {
  announcePackDropOut,
  announceReview,
} from "@/services/workshop/discord";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  modEvents,
  seedModpack,
  seedWorkshop,
  seedMod,
  seedPackMod,
  seedProject,
  seedRequiredDependency,
} from "@/tests/helpers/workshop";

const USER_A = "999900000000000002";
const ADMIN = "999900000000000001";

let manifestFileId = 0;

// Test project ids are ~992_000_000, so a derived file id has to stay in int4
const fileIdFor = (projectId: number) => 700_000 + (projectId % 100_000);

function manifest(
  overrides: Partial<ModpackManifest> & { modIds?: Set<number> } = {},
): ModpackManifest {
  const modIds = overrides.modIds ?? new Set<number>();
  return {
    fileId: ++manifestFileId,
    displayName: null,
    version: null,
    minecraftVersion: null,
    modLoader: null,
    publishedAt: null,
    entries: [...modIds].map((projectId) => ({
      projectId,
      fileId: fileIdFor(projectId),
    })),
    ...overrides,
    modIds,
  };
}

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

describe("ModpackService.getWorkshopAttention", () => {
  it("flags a rejected required dependency of a pack member", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    const depProjectId = await seedProject(ctx, "Rejected Dep");
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    const depMod = await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual({
      type: "rejected_dependency",
      workshopModId: depMod.id,
      curseforgeProjectId: depProjectId,
      name: "Rejected Dep",
      requiredByName: `Vitest Mod ${member.curseforgeProjectId}`,
    });
  });

  it("does not flag a rejected dependency that is itself in the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    const dep = await seedPackMod(ctx, workshop, { origin: "dependency" });
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      dep.curseforgeProjectId,
    );
    await seedMod(ctx, workshop, {
      curseforgeProjectId: dep.curseforgeProjectId,
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "rejected_dependency"),
    ).toHaveLength(0);
  });

  it("flags a required dependency that has not reached the pack yet", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    const depProjectId = await seedProject(ctx, "Testing Dep");
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    const depMod = await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "testing",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual({
      type: "unpromoted_dependency",
      workshopModId: depMod.id,
      curseforgeProjectId: depProjectId,
      name: "Testing Dep",
      requiredByName: `Vitest Mod ${member.curseforgeProjectId}`,
    });
  });

  it("does not flag an unpromoted dependency that already shipped", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "pending",
      submittedBy: USER_A,
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      liveAt: new Date(),
      liveInVersion: "2.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set([depProjectId]) }),
    );

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "unpromoted_dependency"),
    ).toHaveLength(0);
    expect(
      items.filter((item) => item.type === "shipped_unreviewed"),
    ).toHaveLength(1);
  });
});

describe("ModpackService.reconcile", () => {
  it("gives a staged suggestion its row once the pack ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileId: 123,
      fileName: "shipped.jar",
      fileReleaseType: 1,
    });
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: fileIdFor(mod.curseforgeProjectId),
        projectId: mod.curseforgeProjectId,
        displayName: "Shipped 2.0",
        fileName: "shipped-2.0.jar",
        fileDate: null,
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "3.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    // The manifest wins over the file the suggester happened to link
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).toMatchObject({
      origin: "suggestion",
      workshopModId: mod.id,
      fileId: fileIdFor(mod.curseforgeProjectId),
      fileName: "shipped-2.0.jar",
      liveInVersion: "3.0.0",
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileId: 123,
      fileName: "shipped.jar",
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
    });
  });

  it("leaves a staged suggestion alone until the pack ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "3.0.0", modIds: new Set<number>() }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.modpack.mod.count({ modpackId: modpack.id })).toBe(0);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "next_update",
    });
  });

  it("marks members live from the manifest and imports stowaways", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const stowawayId = await seedProject(ctx);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId, stowawayId]),
      }),
    );

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

  it("moves a shipped suggestion to in_pack and back when it drops out", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("in_pack");
    expect(vi.mocked(announceReview)).toHaveBeenCalledTimes(1);

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "shipped",
      workshopId: workshop.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      actorDiscordId: null,
      fromStatus: "next_update",
      toStatus: "in_pack",
      releaseVersion: "2.0.0",
    });

    // A second sweep over the same manifest must not re-announce
    await modpackService.reconcile(modpack.id);
    expect(vi.mocked(announceReview)).toHaveBeenCalledTimes(1);
    expect(await modEvents(mod.id)).toHaveLength(1);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set<number>() }),
    );
    await modpackService.reconcile(modpack.id);

    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe(
      "next_update",
    );
    expect(vi.mocked(announcePackDropOut)).toHaveBeenCalledTimes(1);

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(2);
    });
    expect((await modEvents(mod.id))[1]).toMatchObject({
      eventType: "dropped",
      fromStatus: "in_pack",
      toStatus: "next_update",
      releaseVersion: "2.1.0",
    });
  });

  it("keeps a rejected mod's row while the pack still ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "in_pack",
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
    });
    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).not.toBeNull();
    const items = await modpackService.getWorkshopAttention(workshop);
    expect(
      items.filter((item) => item.type === "shipped_rejected"),
    ).toHaveLength(1);
  });

  it("flags dropped live members and deletes dropped import rows", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const suggestion = await seedMod(ctx, workshop, {
      status: "in_pack",
      submittedBy: USER_A,
    });
    const suggestionRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: suggestion.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: suggestion.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const importRow = await seedPackMod(ctx, workshop, {
      origin: "import",
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await modpackService.reconcile(modpack.id);

    const dropped = await Q.modpack.mod.get({ id: suggestionRow.id });
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
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    const healed = await Q.modpack.mod.get({ id: member.id });
    expect(healed.droppedFromManifestAt).toBeNull();
    expect(healed.liveAt).not.toBeNull();
    expect(healed.liveInVersion).toBe("1.0.0");
  });

  it("credits a shipped mod to its suggestion even mid review", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([pending.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: pending.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: pending.id });
    // Shipping does not finish a review, so it stays pending and is reported
    expect(await Q.workshop.mod.get({ id: pending.id })).toMatchObject({
      status: "pending",
    });
  });

  it("classifies a shipped required dependency of a shipped mod", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const depProjectId = await seedProject(ctx);
    const strangerId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([mod.curseforgeProjectId, depProjectId, strangerId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: depProjectId,
      }),
    ).toMatchObject({ origin: "dependency" });
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: strangerId,
      }),
    ).toMatchObject({ origin: "import" });
  });
});

describe("ModpackService.seedFromManifest", () => {
  const seed = (
    overrides: Partial<
      Parameters<typeof modpackService.seedFromManifest>[1]
    > = {},
  ) => ({
    version: null,
    minecraftVersion: null,
    modLoader: null,
    modIds: [],
    ...overrides,
  });

  it("refuses when the pack follows a published CurseForge project", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5100 });

    await expect(
      modpackService.seedFromManifest(
        modpack.id,
        seed({ modIds: [ctx.nextProjectId++] }),
      ),
    ).rejects.toThrow(BadRequestError);
  });

  it("seeds members as live imports and reports unresolved projects", async () => {
    const workshop = await seedWorkshop(ctx);
    const known = await seedProject(ctx);
    const unknown = ctx.nextProjectId++;

    const result = await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({
        version: "alpha-0.0.1",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.248",
        modIds: [known, unknown],
      }),
    );

    expect(result).toEqual({
      modCount: 2,
      memberCount: 1,
      unresolvedProjectIds: [unknown],
    });
    const member = await Q.modpack.mod.find({
      modpackId: workshop.modpackId,
      curseforgeProjectId: known,
    });
    expect(member).toMatchObject({
      origin: "import",
      workshopModId: null,
      liveInVersion: "alpha-0.0.1",
    });
    expect(member!.liveAt).not.toBeNull();
  });

  it("matches suggestions in any of the pack's workshops and moves staged ones", async () => {
    const modpack = await seedModpack(ctx);
    const closed = await seedWorkshop(ctx, {
      modpackId: modpack.id,
      status: "closed",
    });
    const staged = await seedMod(ctx, closed, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const open = await seedWorkshop(ctx, { modpackId: modpack.id });
    const pending = await seedMod(ctx, open, { submittedBy: USER_A });

    await modpackService.seedFromManifest(
      modpack.id,
      seed({
        version: "0.2.0",
        modIds: [staged.curseforgeProjectId, pending.curseforgeProjectId],
      }),
    );

    expect((await Q.workshop.mod.get({ id: staged.id })).status).toBe(
      "in_pack",
    );
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: staged.curseforgeProjectId,
      }),
    ).toMatchObject({
      origin: "suggestion",
      workshopModId: staged.id,
      liveInVersion: "0.2.0",
    });
    // Shipping does not finish a review, so the pending one keeps its state
    expect((await Q.workshop.mod.get({ id: pending.id })).status).toBe(
      "pending",
    );
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: pending.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: pending.id });
  });

  it("re-seeds as a full sync without recording releases", async () => {
    const workshop = await seedWorkshop(ctx);
    const kept = await seedProject(ctx);
    const dropped = await seedProject(ctx);

    await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({ version: "0.1.0", modIds: [kept, dropped] }),
    );
    await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({ version: "0.2.0", modIds: [kept] }),
    );

    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: dropped,
      }),
    ).toBeNull();
    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: kept,
      }),
    ).toMatchObject({ liveInVersion: "0.1.0" });
    expect(await modpackService.listReleases(workshop.modpackId)).toHaveLength(
      0,
    );
  });

  it("rejects a manifest for a different game version or loader", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    await expect(
      modpackService.seedFromManifest(
        workshop.modpackId,
        seed({ minecraftVersion: "1.20.1", modIds: [projectId] }),
      ),
    ).rejects.toThrow("targets Minecraft 1.20.1");
    await expect(
      modpackService.seedFromManifest(
        workshop.modpackId,
        seed({ modLoader: "fabric-0.16.9", modIds: [projectId] }),
      ),
    ).rejects.toThrow("does not match this workshop's mod loader");
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      0,
    );
  });
});

describe("ModpackService.getPackMods", () => {
  it("attributes a suggestion member to the workshop it came from", async () => {
    const modpack = await seedModpack(ctx);
    const first = await seedWorkshop(ctx, { modpackId: modpack.id });
    const second = await seedWorkshop(ctx, {
      modpackId: modpack.id,
      name: "Vitest QoL Round",
    });
    const suggestion = await seedMod(ctx, second, {
      status: "next_update",
      submittedBy: USER_A,
    });
    await seedPackMod(ctx, first, {
      curseforgeProjectId: suggestion.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: suggestion.id,
      addedBy: null,
    });
    const adminAdd = await seedPackMod(ctx, first);

    const rows = await modpackService.getPackMods(modpack.id);

    expect(
      rows.find(
        (row) => row.curseforgeProjectId === suggestion.curseforgeProjectId,
      ),
    ).toMatchObject({
      suggestionWorkshopId: second.id,
      suggestionWorkshopName: "Vitest QoL Round",
    });
    expect(
      rows.find(
        (row) => row.curseforgeProjectId === adminAdd.curseforgeProjectId,
      ),
    ).toMatchObject({
      suggestionWorkshopId: null,
      suggestionWorkshopName: null,
    });
  });
});

describe("ModpackService release history", () => {
  it("freezes each mod's file when a published pack is read", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5001 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: fileIdFor(member.curseforgeProjectId),
        projectId: member.curseforgeProjectId,
        displayName: "Cool Mod 1.2.3",
        fileName: "coolmod-1.2.3.jar",
        fileDate: "2026-01-01T00:00:00.000Z",
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.236",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    expect(release).toMatchObject({
      version: "1.0.0",
      minecraftVersion: "1.21.1",
      modLoader: "neoforge-21.1.236",
      modCount: 1,
    });
    const rows = await Q.modpack.release.mod.listForReleases([release.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      curseforgeProjectId: member.curseforgeProjectId,
      fileId: fileIdFor(member.curseforgeProjectId),
      fileName: "coolmod-1.2.3.jar",
    });
  });

  it("exposes a release's frozen membership", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5010 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: fileIdFor(member.curseforgeProjectId),
        projectId: member.curseforgeProjectId,
        displayName: "Cool Mod 1.2.3",
        fileName: "coolmod-1.2.3.jar",
        fileDate: "2026-01-01T00:00:00.000Z",
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );
    await modpackService.reconcile(modpack.id);
    const [release] = await modpackService.listReleases(modpack.id);

    const rows = await modpackService.getReleaseMods(release.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      curseforgeProjectId: member.curseforgeProjectId,
      fileId: fileIdFor(member.curseforgeProjectId),
      fileName: "coolmod-1.2.3.jar",
      projectName: `Vitest Mod ${member.curseforgeProjectId}`,
    });
    expect(rows[0]).not.toHaveProperty("releaseId");
  });

  it("rejects an unknown release", async () => {
    await expect(modpackService.getReleaseMods(999_999_999)).rejects.toThrow(
      "not found",
    );
  });

  it("records a published file only once across repeated reconciles", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5002 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const published = manifest({
      version: "1.0.0",
      modIds: new Set([member.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(published);

    await modpackService.reconcile(modpack.id);
    await modpackService.reconcile(modpack.id);

    expect(await modpackService.listReleases(modpack.id)).toHaveLength(1);
  });

  it("keeps an older release readable after a newer one lands", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5003 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const kept = await seedPackMod(ctx, workshop);
    const dropped = await seedPackMod(ctx, workshop);
    const arrival = await seedProject(ctx, "Arrival");

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([
          kept.curseforgeProjectId,
          dropped.curseforgeProjectId,
        ]),
      }),
    );
    await modpackService.reconcile(modpack.id);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.1.0",
        modIds: new Set([kept.curseforgeProjectId, arrival]),
        entries: [
          { projectId: kept.curseforgeProjectId, fileId: 777 },
          { projectId: arrival, fileId: 888 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const releases = await modpackService.listReleases(modpack.id);
    expect(releases.map((r) => r.version)).toEqual(["1.1.0", "1.0.0"]);

    const old = releases[1];
    const oldRows = await Q.modpack.release.mod.listForReleases([old.id]);
    expect(oldRows.map((row) => row.curseforgeProjectId).sort()).toEqual(
      [kept.curseforgeProjectId, dropped.curseforgeProjectId].sort(),
    );
    expect(
      oldRows.find(
        (row) => row.curseforgeProjectId === kept.curseforgeProjectId,
      )?.fileId,
    ).toBe(fileIdFor(kept.curseforgeProjectId));
  });

  it("diffs a release against the one before it", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5004 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const kept = await seedPackMod(ctx, workshop);
    const bumped = await seedPackMod(ctx, workshop);
    const dropped = await seedPackMod(ctx, workshop);
    const arrival = await seedProject(ctx, "Arrival");

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([
          kept.curseforgeProjectId,
          bumped.curseforgeProjectId,
          dropped.curseforgeProjectId,
        ]),
      }),
    );
    await modpackService.reconcile(modpack.id);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.1.0",
        modIds: new Set([
          kept.curseforgeProjectId,
          bumped.curseforgeProjectId,
          arrival,
        ]),
        entries: [
          {
            projectId: kept.curseforgeProjectId,
            fileId: fileIdFor(kept.curseforgeProjectId),
          },
          { projectId: bumped.curseforgeProjectId, fileId: 999_001 },
          { projectId: arrival, fileId: 999_002 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [latest] = await modpackService.listReleases(modpack.id);
    const diff = await modpackService.getReleaseDiff(latest.id);

    expect(diff.previous?.version).toBe("1.0.0");
    expect(diff.added.map((e) => e.curseforgeProjectId)).toEqual([arrival]);
    expect(diff.updated.map((e) => e.curseforgeProjectId)).toEqual([
      bumped.curseforgeProjectId,
    ]);
    expect(diff.updated[0].previousFile?.fileId).toBe(
      fileIdFor(bumped.curseforgeProjectId),
    );
    expect(diff.removed.map((e) => e.curseforgeProjectId)).toEqual([
      dropped.curseforgeProjectId,
    ]);
    expect(diff.unchanged).toBe(1);
  });

  it("treats the first recorded release as a baseline, not an all-added diff", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5005 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    const diff = await modpackService.getReleaseDiff(release.id);

    expect(diff.previous).toBeNull();
    expect(diff.added).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });

  it("points current membership at the newest published file", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5006 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      fileId: 1,
      fileName: "old.jar",
    });
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: 4242,
        projectId: member.curseforgeProjectId,
        displayName: "New 2.0",
        fileName: "new-2.0.jar",
        fileDate: null,
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
        entries: [{ projectId: member.curseforgeProjectId, fileId: 4242 }],
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.modpack.mod.get({ id: member.id })).toMatchObject({
      fileId: 4242,
      fileName: "new-2.0.jar",
    });
  });
});

describe("ModpackService release diff with multi-file mods", () => {
  it("counts a project shipping several files once, and only as changed when its files change", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5007 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const twin = await seedPackMod(ctx, workshop);
    const solo = await seedPackMod(ctx, workshop);

    const twinEntries = [
      { projectId: twin.curseforgeProjectId, fileId: 610_001 },
      { projectId: twin.curseforgeProjectId, fileId: 610_002 },
    ];
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([twin.curseforgeProjectId, solo.curseforgeProjectId]),
        entries: [
          ...twinEntries,
          { projectId: solo.curseforgeProjectId, fileId: 610_003 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [first] = await modpackService.listReleases(modpack.id);
    expect(first.modCount).toBe(2);
    expect(
      await Q.modpack.release.mod.listForReleases([first.id]),
    ).toHaveLength(3);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.1.0",
        modIds: new Set([twin.curseforgeProjectId, solo.curseforgeProjectId]),
        entries: [
          ...twinEntries,
          { projectId: solo.curseforgeProjectId, fileId: 610_099 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [latest] = await modpackService.listReleases(modpack.id);
    const diff = await modpackService.getReleaseDiff(latest.id);

    expect(diff.updated.map((e) => e.curseforgeProjectId)).toEqual([
      solo.curseforgeProjectId,
    ]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });
});

describe("ModpackService.recordRelease durability", () => {
  it("leaves no release behind when the membership write fails", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5008 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const good = await seedPackMod(ctx, workshop);
    const bad = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([good.curseforgeProjectId, bad.curseforgeProjectId]),
        entries: [
          { projectId: good.curseforgeProjectId, fileId: 630_001 },
          // out of int4 range, so the membership insert dies mid-transaction
          { projectId: bad.curseforgeProjectId, fileId: 9_999_999_999 },
        ],
      }),
    );

    await expect(modpackService.reconcile(modpack.id)).rejects.toThrow();

    expect(await modpackService.listReleases(modpack.id)).toHaveLength(0);
  });

  it("tolerates a manifest repeating the same project and file", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5009 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
        entries: [
          { projectId: member.curseforgeProjectId, fileId: 620_001 },
          { projectId: member.curseforgeProjectId, fileId: 620_001 },
        ],
      }),
    );

    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    expect(release.modCount).toBe(1);
    expect(
      await Q.modpack.release.mod.listForReleases([release.id]),
    ).toHaveLength(1);
  });
});
