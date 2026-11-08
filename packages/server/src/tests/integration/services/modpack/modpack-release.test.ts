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
import { modpackSyncService } from "@/services/modpack/sync.service";
import { modpackReleaseService } from "@/services/modpack/release.service";
import { getFilesDetails } from "@/services/curseforge/files";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedPackMod,
  seedProject,
} from "@/tests/helpers/workshop";
import { cleanupLauncherPacks } from "@/tests/helpers/launcher-pack";
import { manifest, sidedManifest, fileIdFor } from "@/tests/helpers/modpack";

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

describe("ModpackReleaseService release history", () => {
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
        gameId: 432,
        downloadUrl: null,
        fileLength: null,
        sha1: null,
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

    await modpackSyncService.reconcile(modpack.id);

    const [release] = await modpackReleaseService.listReleases(modpack.id);
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

  it("hands a release to the launcher pack service until it is ready", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5011 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const read = manifest({
      version: "1.0.0",
      modIds: new Set([member.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(read);

    await modpackSyncService.reconcile(modpack.id);
    const [release] = await modpackReleaseService.listReleases(modpack.id);
    await modpackSyncService.reconcile(modpack.id);

    expect(launcherPackService.prepareRelease).toHaveBeenCalledTimes(2);
    expect(launcherPackService.prepareRelease).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: modpack.id }),
      release.id,
      read,
    );

    await Q.modpack.release.updateAll(
      { launcherReadyAt: new Date() },
      { id: release.id },
    );
    await modpackSyncService.reconcile(modpack.id);

    expect(launcherPackService.prepareRelease).toHaveBeenCalledTimes(2);
  });

  it("records for every file of a release whether the client pack ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const clientOnly = await seedPackMod(ctx, workshop);
    const serverOnly = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [shared.curseforgeProjectId, "both"],
        [clientOnly.curseforgeProjectId, "client"],
        [serverOnly.curseforgeProjectId, "server"],
      ]),
    );

    await modpackSyncService.reconcile(modpack.id);

    const [release] = await modpackReleaseService.listReleases(modpack.id);
    const clientFiles = await Q.modpack.release.mod.getClientFileIds([
      release.id,
    ]);
    expect(clientFiles.map((row) => row.fileId).sort()).toEqual(
      [
        fileIdFor(shared.curseforgeProjectId),
        fileIdFor(clientOnly.curseforgeProjectId),
      ].sort(),
    );
    expect(clientFiles.every((row) => row.releaseId === release.id)).toBe(true);
  });

  it("has the launcher pack service check its releases on every reconcile", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5011 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );
    vi.mocked(launcherPackService.checkReleases).mockClear();

    await modpackSyncService.reconcile(modpack.id);
    await modpackSyncService.reconcile(modpack.id);

    expect(launcherPackService.checkReleases).toHaveBeenCalledTimes(2);
    expect(launcherPackService.checkReleases).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: modpack.id }),
    );
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
        gameId: 432,
        downloadUrl: null,
        fileLength: null,
        sha1: null,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );
    await modpackSyncService.reconcile(modpack.id);
    const [release] = await modpackReleaseService.listReleases(modpack.id);

    const rows = await modpackReleaseService.getReleaseMods(release.id);

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
    await expect(
      modpackReleaseService.getReleaseMods(999_999_999),
    ).rejects.toThrow("not found");
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

    await modpackSyncService.reconcile(modpack.id);
    await modpackSyncService.reconcile(modpack.id);

    expect(await modpackReleaseService.listReleases(modpack.id)).toHaveLength(
      1,
    );
  });

  it("treats a release recorded under its server pack file as already read", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const modIds = new Set([member.curseforgeProjectId]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "1.0.0", fileId: 9100, modIds }),
    );
    await modpackSyncService.reconcile(modpack.id);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        fileId: 9000,
        serverPackFileId: 9100,
        modIds,
      }),
    );
    await modpackSyncService.reconcile(modpack.id);

    const releases = await modpackReleaseService.listReleases(modpack.id);
    expect(releases).toHaveLength(1);
    expect(releases[0].curseforgeFileId).toBe(9100);
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
    await modpackSyncService.reconcile(modpack.id);

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
    await modpackSyncService.reconcile(modpack.id);

    const releases = await modpackReleaseService.listReleases(modpack.id);
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
    await modpackSyncService.reconcile(modpack.id);

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
    await modpackSyncService.reconcile(modpack.id);

    const [latest] = await modpackReleaseService.listReleases(modpack.id);
    const diff = await modpackReleaseService.getReleaseDiff(latest.id);

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
    await modpackSyncService.reconcile(modpack.id);

    const [release] = await modpackReleaseService.listReleases(modpack.id);
    const diff = await modpackReleaseService.getReleaseDiff(release.id);

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
        gameId: 432,
        downloadUrl: null,
        fileLength: null,
        sha1: null,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
        entries: [{ projectId: member.curseforgeProjectId, fileId: 4242 }],
      }),
    );

    await modpackSyncService.reconcile(modpack.id);

    expect(await Q.modpack.mod.get({ id: member.id })).toMatchObject({
      fileId: 4242,
      fileName: "new-2.0.jar",
    });
  });
});

describe("ModpackReleaseService release diff with multi-file mods", () => {
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
    await modpackSyncService.reconcile(modpack.id);

    const [first] = await modpackReleaseService.listReleases(modpack.id);
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
    await modpackSyncService.reconcile(modpack.id);

    const [latest] = await modpackReleaseService.listReleases(modpack.id);
    const diff = await modpackReleaseService.getReleaseDiff(latest.id);

    expect(diff.updated.map((e) => e.curseforgeProjectId)).toEqual([
      solo.curseforgeProjectId,
    ]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });
});
