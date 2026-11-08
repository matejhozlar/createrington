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
vi.mock("@/services/curseforge/modpack", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/modpack")>();
  return { ...actual, getModpackFile: vi.fn(async () => null) };
});
vi.mock("@/services/curseforge/modpack-manifest", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/curseforge/modpack-manifest")
    >();
  return {
    ...actual,
    getModpackManifest: vi.fn(async () => ({
      fileId: 1,
      serverPackFileId: null,
      displayName: null,
      version: null,
      minecraftVersion: null,
      modLoader: null,
      publishedAt: null,
      entries: [],
      modIds: new Set<number>(),
      disabledModIds: new Set<number>(),
    })),
    getModpackModIds: vi.fn(async () => new Set<number>()),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  ingestProjects: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

vi.mock("@/services/modpack/changelog", () => ({
  announceReleaseChangelog: vi.fn(async () => undefined),
}));

vi.mock("@/services/launcher/pack/launcher-pack.service", () => ({
  launcherPackService: {
    prepareRelease: vi.fn(async () => undefined),
    prepareSnapshot: vi.fn(async () => undefined),
    checkReleases: vi.fn(async () => undefined),
  },
}));

vi.mock("@/services/launcher/pack/sandbox-files", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/launcher/pack/sandbox-files")
  >()),
  findSandboxFileUrls: vi.fn(async () => new Map()),
  findSandboxSnapshotUrl: vi.fn(async () => null),
}));

import pool, { Q } from "@/db";
import { BadRequestError } from "@/app/middleware/error-handler";
import { modpackService } from "@/services/modpack/modpack.service";
import { modpackSyncService } from "@/services/modpack/sync.service";
import { modpackReleaseService } from "@/services/modpack/release.service";
import { modpackAttentionService } from "@/services/modpack/attention.service";
import { workshopService } from "@/services/workshop";
import { CurseForgeClass } from "@/services/curseforge/client";
import { getFilesDetails } from "@/services/curseforge/files";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
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
import { cleanupLauncherPacks } from "@/tests/helpers/launcher-pack";
import {
  manifest,
  sidedManifest,
  requiredOf,
  fileIdFor,
} from "@/tests/helpers/modpack";

const USER_A = "999900000000000002";

const ctx = createWorkshopTestContext(992_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
});

afterEach(async () => {
  await cleanupLauncherPacks(ctx);
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("ModpackSyncService.reconcile", () => {
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
        gameId: 432,
        downloadUrl: null,
        fileLength: null,
        sha1: null,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "3.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await modpackSyncService.reconcile(modpack.id);

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

    await modpackSyncService.reconcile(modpack.id);

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

    await modpackSyncService.reconcile(modpack.id);

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

  it("keeps non-mod manifest entries as members and exposes their class", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const shaderId = await seedProject(ctx, "Complementary Shaders", {
      classId: CurseForgeClass.shaders,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set([shaderId]) }),
    );

    await modpackSyncService.reconcile(modpack.id);

    const members = await modpackService.getPackMods(modpack.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      curseforgeProjectId: shaderId,
      origin: "import",
      liveInVersion: "2.0.0",
      project: { classId: CurseForgeClass.shaders },
    });

    const [release] = await modpackReleaseService.listReleases(modpack.id);
    const frozen = await modpackReleaseService.getReleaseMods(release.id);
    expect(frozen).toHaveLength(1);
    expect(frozen[0]).toMatchObject({
      curseforgeProjectId: shaderId,
      classId: CurseForgeClass.shaders,
    });
  });

  it("mirrors the manifest required flag onto members and frozen releases", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const disabledId = await seedProject(ctx, "Create: Rolling Tones");
    const activeId = await seedProject(ctx, "Create");
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([disabledId, activeId]),
        disabledModIds: new Set([disabledId]),
      }),
    );

    await modpackSyncService.reconcile(modpack.id);

    const members = await modpackService.getPackMods(modpack.id);
    expect(requiredOf(members, disabledId)).toBe(false);
    expect(requiredOf(members, activeId)).toBe(true);
    const [first] = await modpackReleaseService.listReleases(modpack.id);
    const frozen = await modpackReleaseService.getReleaseMods(first.id);
    expect(requiredOf(frozen, disabledId)).toBe(false);
    expect(requiredOf(frozen, activeId)).toBe(true);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set([disabledId, activeId]) }),
    );
    await modpackSyncService.reconcile(modpack.id);

    const reenabled = await modpackService.getPackMods(modpack.id);
    expect(requiredOf(reenabled, disabledId)).toBe(true);
    const latest = (await modpackReleaseService.listReleases(modpack.id)).find(
      (release) => release.version === "2.1.0",
    );
    const diff = await modpackReleaseService.getReleaseDiff(latest!.id);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]).toMatchObject({
      curseforgeProjectId: disabledId,
      required: true,
      previousFile: { required: false },
    });
    expect(diff.unchanged).toBe(1);
  });

  it("moves a shipped suggestion to in_pack and back when it drops out", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileChosen: true,
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

    await modpackSyncService.reconcile(modpack.id);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
      fileChosen: false,
    });
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
    await modpackSyncService.reconcile(modpack.id);
    expect(vi.mocked(announceReview)).toHaveBeenCalledTimes(1);
    expect(await modEvents(mod.id)).toHaveLength(1);

    await Q.workshop.mod.updateAll({ fileChosen: true }, { id: mod.id });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set<number>() }),
    );
    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "next_update",
      fileChosen: false,
    });
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
      status: "rejected",
      rejectReason: "incompatible",
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

    await modpackSyncService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).not.toBeNull();
    const items = await modpackAttentionService.getWorkshopAttention(workshop);
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

    await modpackSyncService.reconcile(modpack.id);

    const dropped = await Q.modpack.mod.get({ id: suggestionRow.id });
    expect(dropped.liveAt).toBeNull();
    expect(dropped.liveInVersion).toBeNull();
    expect(dropped.droppedFromManifestAt).not.toBeNull();
    expect(await Q.modpack.mod.find({ id: importRow.id })).toBeNull();
  });

  it("resets a dropped suggestion's required intent to what the pack last published", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const suggestion = await seedMod(ctx, workshop, {
      status: "in_pack",
      submittedBy: USER_A,
      required: false,
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: suggestion.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: suggestion.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
      required: true,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.workshop.mod.get({ id: suggestion.id })).toMatchObject({
      status: "next_update",
      required: true,
    });
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

    await modpackSyncService.reconcile(modpack.id);

    const healed = await Q.modpack.mod.get({ id: member.id });
    expect(healed.droppedFromManifestAt).toBeNull();
    expect(healed.liveAt).not.toBeNull();
    expect(healed.liveInVersion).toBe("1.0.0");
  });

  it("keeps the original drop date across repeated reconciles", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const droppedAt = new Date("2026-01-01T00:00:00Z");
    const member = await seedPackMod(ctx, workshop, {
      origin: "dependency",
      droppedFromManifestAt: droppedAt,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await modpackSyncService.reconcile(modpack.id);

    const row = await Q.modpack.mod.get({ id: member.id });
    expect(row.droppedFromManifestAt).toEqual(droppedAt);
  });

  it("credits a shipped mod to its suggestion and ships it even mid review", async () => {
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

    await modpackSyncService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: pending.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: pending.id });
    expect(await Q.workshop.mod.get({ id: pending.id })).toMatchObject({
      status: "in_pack",
    });
    await vi.waitFor(async () => {
      expect(await modEvents(pending.id)).toHaveLength(1);
    });
    expect((await modEvents(pending.id))[0]).toMatchObject({
      eventType: "shipped",
      fromStatus: "pending",
      toStatus: "in_pack",
      releaseVersion: "2.0.0",
    });
  });

  it("heals a linked suggestion the pack ships but the pipeline left behind", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
      liveAt: new Date(),
      liveInVersion: "2.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
    });
    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "shipped",
      fromStatus: "approved",
      toStatus: "in_pack",
      releaseVersion: "2.0.0",
    });
  });

  it("links a shipped mod to its rejected suggestion without unrejecting it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: mod.id });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    expect(vi.mocked(announceReview)).not.toHaveBeenCalled();
    expect(await modEvents(mod.id)).toHaveLength(0);
  });

  it("drops a mid-review shipped mod back to next_update like any other member", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );
    await modpackSyncService.reconcile(modpack.id);
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("in_pack");

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set<number>() }),
    );
    await modpackSyncService.reconcile(modpack.id);

    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe(
      "next_update",
    );
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

    await modpackSyncService.reconcile(modpack.id);

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

describe("ModpackSyncService.reconcile across the client file and server pack", () => {
  it("keeps a client-only member live when only the client manifest lists it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const clientOnly = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [shared.curseforgeProjectId, "both"],
        [clientOnly.curseforgeProjectId, "client"],
      ]),
    );

    await modpackSyncService.reconcile(modpack.id);

    const row = await Q.modpack.mod.get({ id: clientOnly.id });
    expect(row.liveAt).not.toBeNull();
    expect(row.liveInVersion).toBe("2.0.0");
    expect(row.droppedFromManifestAt).toBeNull();
  });

  it("keeps a server-only member live when only the server pack lists it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const serverOnly = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [shared.curseforgeProjectId, "both"],
        [serverOnly.curseforgeProjectId, "server"],
      ]),
    );

    await modpackSyncService.reconcile(modpack.id);

    const row = await Q.modpack.mod.get({ id: serverOnly.id });
    expect(row.liveAt).not.toBeNull();
    expect(row.liveInVersion).toBe("2.0.0");
    expect(row.droppedFromManifestAt).toBeNull();
    const attention =
      await modpackAttentionService.getWorkshopAttention(workshop);
    expect(
      attention.filter((item) => item.type === "dropped_from_pack"),
    ).toEqual([]);
  });

  it("leaves unflagged members unspecified so they keep surfacing for review", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const bothId = await seedProject(ctx);
    const clientId = await seedProject(ctx);
    const serverId = await seedProject(ctx);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [bothId, "both"],
        [clientId, "client"],
        [serverId, "server"],
      ]),
    );

    await modpackSyncService.reconcile(modpack.id);

    for (const id of [bothId, clientId, serverId]) {
      expect(await Q.curseforge.project.get({ id })).toMatchObject({
        environment: "unspecified",
        environmentSource: null,
      });
    }
    const attention =
      await modpackAttentionService.getWorkshopAttention(workshop);
    expect(
      attention
        .filter((item) => item.type === "environment_unspecified")
        .map((item) => item.curseforgeProjectId)
        .sort(),
    ).toEqual([bothId, clientId, serverId].sort());
  });

  it("leaves a manual environment flag alone", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "client",
      environmentSource: "manual",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "both"]]),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "client",
      environmentSource: "manual",
    });
  });

  it("confirms a CurseForge hint the pack shipped to the same side(s)", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "both",
      environmentSource: "cf_flag",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "both"]]),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "manifest",
    });
  });

  it("leaves a CurseForge hint the pack disagrees with alone", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "both",
      environmentSource: "cf_flag",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "client"]]),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "cf_flag",
    });
  });

  it("keeps a flag cleared to unspecified clear across a reconcile", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "server",
      environmentSource: "manual",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "server"]]),
    );
    await modpackSyncService.reconcile(modpack.id);

    await workshopService.setProjectEnvironment(projectId, "unspecified");
    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "unspecified",
      environmentSource: null,
    });
  });

  it("does not confirm environments when the release ships no server pack", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "both",
      environmentSource: "cf_flag",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set([projectId]) }),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "cf_flag",
    });
  });
});

describe("ModpackSyncService.reconcile for a pack that ships a server pack", () => {
  it("refuses a client-only read and leaves members and suggestions untouched", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
      shipsServerPack: true,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "in_pack",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await expect(modpackSyncService.reconcile(modpack.id)).rejects.toThrow(
      BadRequestError,
    );

    expect(await Q.modpack.mod.get({ id: member.id })).toMatchObject({
      droppedFromManifestAt: null,
      liveInVersion: "1.0.0",
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
    });
    expect(await modEvents(mod.id)).toEqual([]);
    expect(announcePackDropOut).not.toHaveBeenCalled();
    expect(await modpackReleaseService.listReleases(modpack.id)).toEqual([]);
  });

  it("keeps reconciling a client-only pack and flips the flag once a server pack is read", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackSyncService.reconcile(modpack.id);
    expect(await Q.modpack.get({ id: modpack.id })).toMatchObject({
      shipsServerPack: false,
    });

    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[member.curseforgeProjectId, "both"]]),
    );
    await modpackSyncService.reconcile(modpack.id);
    expect(await Q.modpack.get({ id: modpack.id })).toMatchObject({
      shipsServerPack: true,
    });
  });
});

describe("ModpackSyncService.seedFromManifest", () => {
  const seed = ({
    modIds = [],
    disabledModIds = [],
    ...overrides
  }: Partial<
    Omit<Parameters<typeof modpackSyncService.seedFromManifest>[1], "files">
  > & { modIds?: number[]; disabledModIds?: number[] } = {}) => ({
    version: null,
    minecraftVersion: null,
    modLoader: null,
    files: modIds.map((projectId) => ({
      projectId,
      required: !disabledModIds.includes(projectId),
    })),
    ...overrides,
  });

  it("keeps entries flagged not required as disabled members", async () => {
    const workshop = await seedWorkshop(ctx);
    const disabledId = await seedProject(ctx, "Disabled Mod");
    const activeId = await seedProject(ctx, "Active Mod");

    await modpackSyncService.seedFromManifest(
      workshop.modpackId,
      seed({ modIds: [disabledId, activeId], disabledModIds: [disabledId] }),
    );

    const members = await modpackService.getPackMods(workshop.modpackId);
    expect(requiredOf(members, disabledId)).toBe(false);
    expect(requiredOf(members, activeId)).toBe(true);
  });

  // CurseForge exports repeat a project that ships more than one file, so the
  // seed merges the entries and reports them instead of failing the import
  it("merges repeated projects and reports them", async () => {
    const workshop = await seedWorkshop(ctx);
    const repeated = await seedProject(ctx);
    const other = await seedProject(ctx);

    const result = await modpackSyncService.seedFromManifest(
      workshop.modpackId,
      seed({ modIds: [repeated, other, repeated] }),
    );

    expect(result).toMatchObject({
      modCount: 2,
      memberCount: 2,
      duplicateProjectIds: [repeated],
    });
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      2,
    );
  });

  it("refuses when the pack follows a published CurseForge project", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5100 });

    await expect(
      modpackSyncService.seedFromManifest(
        modpack.id,
        seed({ modIds: [ctx.nextProjectId++] }),
      ),
    ).rejects.toThrow(BadRequestError);
  });

  it("seeds members as live imports and reports unresolved projects", async () => {
    const workshop = await seedWorkshop(ctx);
    const known = await seedProject(ctx);
    const unknown = ctx.nextProjectId++;

    const result = await modpackSyncService.seedFromManifest(
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
      duplicateProjectIds: [],
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

    await modpackSyncService.seedFromManifest(
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
    expect((await Q.workshop.mod.get({ id: pending.id })).status).toBe(
      "in_pack",
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

    await modpackSyncService.seedFromManifest(
      workshop.modpackId,
      seed({ version: "0.1.0", modIds: [kept, dropped] }),
    );
    await modpackSyncService.seedFromManifest(
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
    expect(
      await modpackReleaseService.listReleases(workshop.modpackId),
    ).toHaveLength(0);
  });

  it("counts only the manifest's mods when a dropped suggestion member keeps its row", async () => {
    const modpack = await seedModpack(ctx);
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const staged = await seedMod(ctx, workshop, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const keeper = await seedProject(ctx);

    await modpackSyncService.seedFromManifest(
      modpack.id,
      seed({
        version: "0.1.0",
        modIds: [staged.curseforgeProjectId, keeper],
      }),
    );
    expect((await Q.workshop.mod.get({ id: staged.id })).status).toBe(
      "in_pack",
    );

    const result = await modpackSyncService.seedFromManifest(
      modpack.id,
      seed({ version: "0.2.0", modIds: [keeper] }),
    );

    expect(result).toEqual({
      modCount: 1,
      memberCount: 1,
      unresolvedProjectIds: [],
      duplicateProjectIds: [],
    });
    expect((await Q.workshop.mod.get({ id: staged.id })).status).toBe(
      "next_update",
    );
    const droppedRow = await Q.modpack.mod.find({
      modpackId: modpack.id,
      curseforgeProjectId: staged.curseforgeProjectId,
    });
    expect(droppedRow!.droppedFromManifestAt).not.toBeNull();
    expect(droppedRow!.liveAt).toBeNull();
  });

  it("rejects a manifest for a different game version or loader", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    await expect(
      modpackSyncService.seedFromManifest(
        workshop.modpackId,
        seed({ minecraftVersion: "1.20.1", modIds: [projectId] }),
      ),
    ).rejects.toThrow("targets Minecraft 1.20.1");
    await expect(
      modpackSyncService.seedFromManifest(
        workshop.modpackId,
        seed({ modLoader: "fabric-0.16.9", modIds: [projectId] }),
      ),
    ).rejects.toThrow("does not match this pack's mod loader");
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      0,
    );
  });
});
