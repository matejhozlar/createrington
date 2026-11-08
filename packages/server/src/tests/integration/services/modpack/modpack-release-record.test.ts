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

vi.mock("@/services/launcher/pack/pack-release.service", () => ({
  launcherPackReleaseService: {
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
import { modpackSyncService } from "@/services/modpack/sync.service";
import { modpackReleaseService } from "@/services/modpack/release.service";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
import { announceReleaseChangelog } from "@/services/modpack/changelog";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedPackMod,
} from "@/tests/helpers/workshop";
import { cleanupLauncherPacks } from "@/tests/helpers/launcher-pack";
import { manifest, sidedManifest } from "@/tests/helpers/modpack";

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

describe("recordRelease durability", () => {
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

    await expect(modpackSyncService.reconcile(modpack.id)).rejects.toThrow();

    expect(await modpackReleaseService.listReleases(modpack.id)).toHaveLength(
      0,
    );
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

    await modpackSyncService.reconcile(modpack.id);

    const [release] = await modpackReleaseService.listReleases(modpack.id);
    expect(release.modCount).toBe(1);
    expect(
      await Q.modpack.release.mod.listForReleases([release.id]),
    ).toHaveLength(1);
  });
});

describe("recordRelease upgrade", () => {
  it("re-freezes a release recorded from the client file alone once the server pack is read, never the other way", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const serverOnly = await seedPackMod(ctx, workshop);
    const clientOnly = manifest({
      version: "0.6.3",
      modIds: new Set([shared.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(clientOnly);

    await modpackSyncService.reconcile(modpack.id);
    const [frozen] = await modpackReleaseService.listReleases(modpack.id);
    expect(frozen).toMatchObject({ modCount: 1, serverPackFileId: null });

    vi.mocked(getModpackManifest).mockResolvedValue({
      ...sidedManifest("0.6.3", [
        [shared.curseforgeProjectId, "both"],
        [serverOnly.curseforgeProjectId, "server"],
      ]),
      fileId: clientOnly.fileId,
      serverPackFileId: 900_001,
    });
    await modpackSyncService.reconcile(modpack.id);

    const releases = await modpackReleaseService.listReleases(modpack.id);
    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({
      id: frozen.id,
      modCount: 2,
      serverPackFileId: 900_001,
    });
    expect(
      await Q.modpack.release.mod.listForReleases([frozen.id]),
    ).toHaveLength(2);

    vi.mocked(getModpackManifest).mockResolvedValue(clientOnly);
    await expect(modpackSyncService.reconcile(modpack.id)).rejects.toThrow(
      BadRequestError,
    );
    expect(
      (await modpackReleaseService.listReleases(modpack.id))[0],
    ).toMatchObject({
      modCount: 2,
      serverPackFileId: 900_001,
    });
  });
});

describe("recordRelease changelog announcements", () => {
  it("starts an announcement once a release is read with its server pack, then only resumes", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[member.curseforgeProjectId, "both"]]),
    );

    await modpackSyncService.reconcile(modpack.id);
    const [release] = await modpackReleaseService.listReleases(modpack.id);
    expect(release.announcement).toBeNull();
    expect(announceReleaseChangelog).toHaveBeenCalledTimes(1);
    expect(announceReleaseChangelog).toHaveBeenLastCalledWith(
      expect.objectContaining({ releaseId: release.id, start: true }),
    );

    await modpackSyncService.reconcile(modpack.id);
    expect(announceReleaseChangelog).toHaveBeenCalledTimes(2);
    expect(announceReleaseChangelog).toHaveBeenLastCalledWith(
      expect.objectContaining({ releaseId: release.id, start: false }),
    );
  });

  it("never announces a client-only read and starts once the server pack arrives", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const clientOnly = manifest({
      version: "1.0.0",
      modIds: new Set([member.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(clientOnly);

    await modpackSyncService.reconcile(modpack.id);
    await modpackSyncService.reconcile(modpack.id);
    expect(announceReleaseChangelog).not.toHaveBeenCalled();

    vi.mocked(getModpackManifest).mockResolvedValue({
      ...sidedManifest("1.0.0", [[member.curseforgeProjectId, "both"]]),
      fileId: clientOnly.fileId,
    });
    await modpackSyncService.reconcile(modpack.id);

    const [release] = await modpackReleaseService.listReleases(modpack.id);
    expect(release.serverPackFileId).not.toBeNull();
    expect(announceReleaseChangelog).toHaveBeenCalledTimes(1);
    expect(announceReleaseChangelog).toHaveBeenLastCalledWith(
      expect.objectContaining({ releaseId: release.id, start: true }),
    );
  });
});
