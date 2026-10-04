import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/services/curseforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/curseforge")>();
  return {
    ...actual,
    getFilesDetails: vi.fn(async () => []),
    getModpackFile: vi.fn(async () => null),
    getServedFileIds: vi.fn(async (fileIds: number[]) => new Set(fileIds)),
  };
});
vi.mock("@/services/curseforge/ingest", () => ({
  ingestProjectsWhere: vi.fn(async () => 0),
}));
vi.mock("@/services/modrinth", () => ({
  findModrinthFilesBySha1: vi.fn(async () => new Map()),
}));
vi.mock("@/services/launcher/pack/curseforge-cdn", () => ({
  findCurseforgeCdnUrls: vi.fn(async () => new Map()),
}));
vi.mock("@/services/launcher/pack/sandbox-files", () => ({
  findSandboxFileUrls: vi.fn(async () => new Map()),
}));
vi.mock("@/utils/mojang-java-version", () => ({
  getMinecraftJavaMajorVersion: vi.fn(async () => 21),
}));

import config from "@/config";
import pool, { Q } from "@/db";
import { Discord } from "@/discord/constants";
import {
  getFilesDetails,
  getModpackFile,
  getServedFileIds,
  type CurseForgeFileDetail,
  type ModpackFile,
  type ModpackManifest,
  type ModpackManifestSides,
} from "@/services/curseforge";
import { ingestProjectsWhere } from "@/services/curseforge/ingest";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import { findCurseforgeCdnUrls } from "@/services/launcher/pack/curseforge-cdn";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { findSandboxFileUrls } from "@/services/launcher/pack/sandbox-files";
import { findModrinthFilesBySha1 } from "@/services/modrinth";
import { getMinecraftJavaMajorVersion } from "@/utils/mojang-java-version";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import { LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE } from "@createrington/shared/launcher";
import {
  cleanupWorkshopTestContext,
  createWorkshopTestContext,
  makeProjectData,
  seedModpack,
  seedProject,
} from "@/tests/helpers/workshop";

const PACK_PROJECT_ID = 995_900_001;
const HOUR_MS = 60 * 60 * 1000;
const FIRST_PAGE = { page: 0, limit: 25 };

const ctx = createWorkshopTestContext(995_000_000);
const originalPackProjectId = config.curseforge.modpackProjectId;
let cdnFlagBefore: boolean | null = null;

let nextFileId = 990_000_000;
let nextPackFileId = 990_500_000;

const sha1Of = (fileId: number) => fileId.toString(16).padStart(40, "0");
const cdnUrl = (fileId: number) =>
  `https://edge.forgecdn.net/files/${fileId}/mod-${fileId}.jar`;
const modrinthUrl = (fileId: number) =>
  `https://cdn.modrinth.com/data/vitest/versions/${fileId}/mod-${fileId}.jar`;
const builtCdnUrl = (fileId: number) =>
  `https://mediafilez.forgecdn.net/files/vitest/${fileId}/mod-${fileId}.jar`;
const sandboxUrl = (fileId: number) =>
  `https://sandbox.createrington.test/api/pack/files/${fileId}`;

interface SeededFile {
  fileId: number;
  projectId: number;
  sides: ModpackManifestSides;
  required: boolean;
  detail: CurseForgeFileDetail;
}

async function seedFile(
  options: {
    blocked?: boolean;
    classId?: number;
    sides?: ModpackManifestSides;
    required?: boolean;
    detail?: Partial<CurseForgeFileDetail>;
    newFileOf?: SeededFile;
  } = {},
): Promise<SeededFile> {
  const projectId =
    options.newFileOf?.projectId ??
    (await seedProject(ctx, undefined, {
      classId: options.classId ?? 6,
      websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${nextFileId}`,
    }));
  const fileId = nextFileId++;
  return {
    fileId,
    projectId,
    sides: options.sides ?? "both",
    required: options.required ?? true,
    detail: {
      fileId,
      projectId,
      displayName: `Mod ${fileId}`,
      fileName: `mod-${fileId}.jar`,
      fileDate: null,
      releaseType: 1,
      gameId: 432,
      downloadUrl: options.blocked ? null : cdnUrl(fileId),
      fileLength: 1000 + (fileId % 1000),
      sha1: sha1Of(fileId),
      ...options.detail,
    },
  };
}

function serveFromCurseForge(files: SeededFile[]): void {
  const byId = new Map(files.map((file) => [file.fileId, file.detail]));
  vi.mocked(getFilesDetails).mockImplementation(async (fileIds) =>
    fileIds.flatMap((id) => byId.get(id) ?? []),
  );
}

function serveFromModrinth(files: SeededFile[]): void {
  const hosted = new Map(
    files.map((file) => [sha1Of(file.fileId), modrinthUrl(file.fileId)]),
  );
  vi.mocked(findModrinthFilesBySha1).mockImplementation(async (hashes) => {
    return new Map(
      hashes.flatMap((sha1) => {
        const url = hosted.get(sha1);
        return url
          ? [[sha1, { sha1, url, fileName: "mod.jar", size: 1 }] as const]
          : [];
      }),
    );
  });
}

function serveFromBuiltCdnAddress(files: SeededFile[]): void {
  const answering = new Set(files.map((file) => file.fileId));
  vi.mocked(findCurseforgeCdnUrls).mockImplementation(async (queries) => {
    return new Map(
      queries.flatMap((query) =>
        answering.has(query.fileId)
          ? [[query.fileId, builtCdnUrl(query.fileId)] as const]
          : [],
      ),
    );
  });
}

function serveFromSandbox(files: SeededFile[]): void {
  vi.mocked(findSandboxFileUrls).mockResolvedValue(
    new Map(files.map((file) => [file.fileId, sandboxUrl(file.fileId)])),
  );
}

const useBuiltCdnAddress = (enabled: boolean) =>
  featureFlagService.setEnabled(FeatureFlags.launcherCurseforgeCdn, enabled);

const ageStoredFile = (fileId: number, ageMs: number) =>
  Q.curseforge.file.updateAll(
    { resolvedAt: new Date(Date.now() - ageMs) },
    { id: fileId },
  );

function ingestFromCurseForge(classByProject: Map<number, number>): void {
  vi.mocked(ingestProjectsWhere).mockImplementation(
    async (projectIds, accept) => {
      let added = 0;
      for (const id of projectIds) {
        const data = makeProjectData(id, {
          classId: classByProject.get(id) ?? 6,
        });
        if (!accept(data)) continue;
        await Q.curseforge.project.create({
          id,
          classId: data.classId,
          slug: data.slug,
          name: data.name,
        });
        added++;
      }
      return added;
    },
  );
}

function packZip(fileId: number, overrides: Partial<ModpackFile> = {}) {
  vi.mocked(getModpackFile).mockResolvedValue({
    id: fileId,
    projectId: PACK_PROJECT_ID,
    displayName: "Vitest Pack 1.0.0",
    fileName: `vitest-pack-${fileId}.zip`,
    fileDate: "2026-10-01T10:00:00.000Z",
    downloadUrl: `https://edge.forgecdn.net/files/${fileId}/vitest-pack.zip`,
    fileLength: 4_500_000,
    sha1: sha1Of(fileId),
    fileStatus: 4,
    isAvailable: true,
    serverPackFileId: null,
    alternateFileId: null,
    parentProjectFileId: null,
    isServerPack: false,
    ...overrides,
  });
}

async function seedRelease(
  modpack: Modpack,
  version: string,
  files: SeededFile[],
  overrides: Partial<ModpackManifest> = {},
): Promise<{ release: ModpackRelease; manifest: ModpackManifest }> {
  const manifest: ModpackManifest = {
    fileId: nextPackFileId++,
    serverPackFileId: null,
    displayName: `Vitest Pack ${version}`,
    version,
    minecraftVersion: "1.21.1",
    modLoader: "neoforge-21.1.249",
    publishedAt: "2026-10-01T10:00:00.000Z",
    entries: files.map((file) => ({
      projectId: file.projectId,
      fileId: file.fileId,
      required: file.required,
      sides: file.sides,
    })),
    modIds: new Set(files.map((file) => file.projectId)),
    disabledModIds: new Set(),
    ...overrides,
  };
  const release = await Q.modpack.release.createAndReturn({
    modpackId: modpack.id,
    curseforgeFileId: manifest.fileId,
    version: manifest.version,
    displayName: manifest.displayName,
    minecraftVersion: manifest.minecraftVersion,
    modLoader: manifest.modLoader,
    modCount: files.length,
    publishedAt: new Date("2026-10-01T10:00:00.000Z"),
  });
  await Q.modpack.release.mod.insertMany(
    release.id,
    files.map((file) => ({
      curseforgeProjectId: file.projectId,
      fileId: file.fileId,
      fileName: file.detail.fileName,
      displayName: file.detail.displayName,
      fileReleaseType: file.detail.releaseType,
      fileDate: null,
      required: file.required,
      inClientPack: file.sides !== "server",
    })),
  );
  packZip(manifest.fileId);
  return { release, manifest };
}

async function seedReadyRelease(
  modpack: Modpack,
  version: string,
  files: SeededFile[],
): Promise<{ release: ModpackRelease; manifest: ModpackManifest }> {
  const seeded = await seedRelease(modpack, version, files);
  await launcherPackService.prepareRelease(
    modpack,
    seeded.release.id,
    seeded.manifest,
  );
  return seeded;
}

function archivedOnCurseForge(fileIds: number[]): void {
  const archived = new Set(fileIds);
  vi.mocked(getServedFileIds).mockImplementation(
    async (asked) => new Set(asked.filter((id) => !archived.has(id))),
  );
}

const listedVersions = async () =>
  (await launcherPackService.listReleases(FIRST_PAGE)).releases.map(
    (release) => release.version,
  );

async function seedPack(): Promise<Modpack> {
  return seedModpack(ctx, {
    name: "Vitest Pack",
    curseforgeProjectId: PACK_PROJECT_ID,
  });
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; statusCode?: number };
  }
  throw new Error("Expected the call to be refused");
}

const isReady = async (releaseId: number) =>
  (await Q.modpack.release.get({ id: releaseId })).launcherReadyAt !== null;

beforeAll(async () => {
  await pool.query("SELECT 1");
  const flag = await Q.feature.flag.find({
    name: FeatureFlags.launcherCurseforgeCdn,
  });
  cdnFlagBefore = flag?.enabled ?? null;
  await useBuiltCdnAddress(false);
});

beforeEach(() => {
  (config.curseforge as { modpackProjectId: number }).modpackProjectId =
    PACK_PROJECT_ID;
  vi.mocked(getFilesDetails).mockResolvedValue([]);
  vi.mocked(getModpackFile).mockResolvedValue(null);
  archivedOnCurseForge([]);
  vi.mocked(ingestProjectsWhere).mockResolvedValue(0);
  vi.mocked(findModrinthFilesBySha1).mockResolvedValue(new Map());
  vi.mocked(findCurseforgeCdnUrls).mockResolvedValue(new Map());
  vi.mocked(findSandboxFileUrls).mockResolvedValue(new Map());
  vi.mocked(getMinecraftJavaMajorVersion).mockResolvedValue(21);
  sendMock.mockResolvedValue({ success: true });
  vi.spyOn(Discord, "Messages", "get").mockReturnValue({
    send: sendMock,
  } as unknown as typeof Discord.Messages);
});

afterEach(async () => {
  if (ctx.projectIds.length > 0) {
    await Q.curseforge.file.deleteAll({
      curseforgeProjectId: { $in: ctx.projectIds },
    });
  }
  await cleanupWorkshopTestContext(ctx);
  await useBuiltCdnAddress(false);
  vi.resetAllMocks();
});

afterAll(async () => {
  (config.curseforge as { modpackProjectId: number }).modpackProjectId =
    originalPackProjectId;
  if (cdnFlagBefore === null) {
    await Q.feature.flag.deleteAll({
      name: FeatureFlags.launcherCurseforgeCdn,
    });
  } else {
    await useBuiltCdnAddress(cdnFlagBefore);
  }
  await pool.end();
});

describe("LauncherPackService.prepareRelease", () => {
  it("makes a release ready and serves it as the latest pack", async () => {
    const modpack = await seedPack();
    const files = [await seedFile(), await seedFile()];
    serveFromCurseForge(files);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await launcherPackService.getLatestPack()).toEqual({
      version: "1.0.0",
      releasedAt: "2026-10-01T10:00:00.000Z",
      minecraftVersion: "1.21.1",
      modLoader: {
        id: "neoforge-21.1.249",
        name: "neoforge",
        version: "21.1.249",
      },
      javaMajorVersion: 21,
      zip: {
        fileId: manifest.fileId,
        fileName: `vitest-pack-${manifest.fileId}.zip`,
        url: `https://edge.forgecdn.net/files/${manifest.fileId}/vitest-pack.zip`,
        size: 4_500_000,
        sha1: sha1Of(manifest.fileId),
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stores each client file with its source, folder and CurseForge hash", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const onModrinth = await seedFile({ blocked: true });
    const shader = await seedFile({ classId: 6552, sides: "client" });
    const resourcePack = await seedFile({ classId: 12, sides: "client" });
    const files = [served, onModrinth, shader, resourcePack];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth, served]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    vi.mocked(getFilesDetails).mockClear();
    const resolved = await launcherPackService.resolveFiles(
      files.map((file) => file.fileId),
    );

    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(resolved.unresolvedFileIds).toEqual([]);
    expect(resolved.files).toEqual([
      {
        projectId: served.projectId,
        fileId: served.fileId,
        fileName: `mod-${served.fileId}.jar`,
        size: served.detail.fileLength,
        sha1: sha1Of(served.fileId),
        folder: "mods",
        source: "curseforge",
        url: cdnUrl(served.fileId),
        pageUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${served.fileId}/files/${served.fileId}`,
      },
      expect.objectContaining({
        fileId: onModrinth.fileId,
        sha1: sha1Of(onModrinth.fileId),
        folder: "mods",
        source: "modrinth",
        url: modrinthUrl(onModrinth.fileId),
      }),
      expect.objectContaining({
        fileId: shader.fileId,
        folder: "shaderpacks",
        source: "curseforge",
      }),
      expect.objectContaining({
        fileId: resourcePack.fileId,
        folder: "resourcepacks",
        source: "curseforge",
      }),
    ]);
  });

  it("only asks Modrinth about files CurseForge blocks", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([served, blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      served,
      blocked,
    ]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findModrinthFilesBySha1).toHaveBeenCalledWith([
      sha1Of(blocked.fileId),
    ]);
  });

  it("tells the owner when a client file has no download source", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const manual = await seedFile({ blocked: true });
    const disabled = await seedFile({ blocked: true, required: false });
    const files = [served, manual, disabled];
    serveFromCurseForge(files);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await isReady(release.id)).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const notice = sendMock.mock.calls[0][0];
    expect(notice.channelId).toBe(
      Discord.Channels.administration.NOTIFICATIONS,
    );
    expect(notice.content).toBe(`<@${config.app.auth.owner.discordId}>`);
    expect(notice.embeds.data.description).toContain("Vitest Pack 1.0.0");
    expect(notice.embeds.data.description).toContain(
      `mod-${manual.fileId}.jar`,
    );
    expect(notice.embeds.data.description).toContain(
      `\`mod-${disabled.fileId}.jar\` (ships disabled)`,
    );
    expect(notice.embeds.data.description).not.toContain(
      `mod-${served.fileId}.jar`,
    );

    const resolved = await launcherPackService.resolveFiles([manual.fileId]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: manual.fileId,
        source: "manual",
        url: null,
        sha1: sha1Of(manual.fileId),
        pageUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${manual.fileId}/files/${manual.fileId}`,
      }),
    ]);
  });

  it("hands out the sandbox copy of a file neither CDN serves, and asks the sandbox about nothing else", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const onModrinth = await seedFile({ blocked: true });
    const onSandbox = await seedFile({ blocked: true });
    const files = [served, onModrinth, onSandbox];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findSandboxFileUrls).toHaveBeenCalledTimes(1);
    expect(findSandboxFileUrls).toHaveBeenCalledWith([
      {
        fileId: onSandbox.fileId,
        sha1: sha1Of(onSandbox.fileId),
        size: onSandbox.detail.fileLength,
      },
    ]);
    expect(sendMock).not.toHaveBeenCalled();
    const resolved = await launcherPackService.resolveFiles([onSandbox.fileId]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: onSandbox.fileId,
        source: "storage",
        url: sandboxUrl(onSandbox.fileId),
        sha1: sha1Of(onSandbox.fileId),
      }),
    ]);
  });

  it("hands out the built CDN address of a blocked file Modrinth lacks, and asks the sandbox only about what is left", async () => {
    await useBuiltCdnAddress(true);
    const modpack = await seedPack();
    const served = await seedFile();
    const onModrinth = await seedFile({ blocked: true });
    const onCdn = await seedFile({ blocked: true });
    const onSandbox = await seedFile({ blocked: true });
    const files = [served, onModrinth, onCdn, onSandbox];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth]);
    serveFromBuiltCdnAddress([onCdn, onModrinth, served]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(1);
    expect(findCurseforgeCdnUrls).toHaveBeenCalledWith([
      {
        fileId: onCdn.fileId,
        fileName: `mod-${onCdn.fileId}.jar`,
        size: onCdn.detail.fileLength,
      },
      {
        fileId: onSandbox.fileId,
        fileName: `mod-${onSandbox.fileId}.jar`,
        size: onSandbox.detail.fileLength,
      },
    ]);
    expect(findSandboxFileUrls).toHaveBeenCalledWith([
      expect.objectContaining({ fileId: onSandbox.fileId }),
    ]);
    expect(sendMock).not.toHaveBeenCalled();
    const resolved = await launcherPackService.resolveFiles(
      files.map((file) => file.fileId),
    );
    expect(resolved.files).toEqual([
      expect.objectContaining({ fileId: served.fileId, source: "curseforge" }),
      expect.objectContaining({
        fileId: onModrinth.fileId,
        source: "modrinth",
      }),
      expect.objectContaining({
        fileId: onCdn.fileId,
        source: "curseforge-cdn",
        url: builtCdnUrl(onCdn.fileId),
        sha1: sha1Of(onCdn.fileId),
      }),
      expect.objectContaining({ fileId: onSandbox.fileId, source: "storage" }),
    ]);
  });

  it("falls through to manual and tells the owner when the built address does not answer", async () => {
    await useBuiltCdnAddress(true);
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(1);
    expect(await isReady(release.id)).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      `mod-${blocked.fileId}.jar`,
    );
    const resolved = await launcherPackService.resolveFiles([blocked.fileId]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: blocked.fileId,
        source: "manual",
        url: null,
      }),
    ]);
  });

  it("does not build an address while the source is switched off", async () => {
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    serveFromBuiltCdnAddress([blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findCurseforgeCdnUrls).not.toHaveBeenCalled();
    const resolved = await launcherPackService.resolveFiles([blocked.fileId]);
    expect(resolved.files[0].source).toBe("manual");
  });

  it("checks a stored built address again when a release is prepared", async () => {
    await useBuiltCdnAddress(true);
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    serveFromBuiltCdnAddress([blocked]);
    await launcherPackService.resolveFiles([blocked.fileId]);
    serveFromBuiltCdnAddress([]);
    serveFromSandbox([blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    const resolved = await launcherPackService.resolveFiles([blocked.fileId]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: blocked.fileId,
        source: "storage",
        url: sandboxUrl(blocked.fileId),
      }),
    ]);
  });

  it("leaves files that only the server pack ships alone", async () => {
    const modpack = await seedPack();
    const client = await seedFile();
    const serverOnly = await seedFile({ blocked: true, sides: "server" });
    serveFromCurseForge([client, serverOnly]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      client,
      serverOnly,
    ]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await isReady(release.id)).toBe(true);
    expect(getFilesDetails).toHaveBeenCalledWith([client.fileId]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("keeps offering the previous release while a newer one has a client file CurseForge does not know", async () => {
    const modpack = await seedPack();
    const known = await seedFile();
    const unknown = await seedFile();
    serveFromCurseForge([known]);
    const first = await seedRelease(modpack, "1.0.0", [known]);
    await launcherPackService.prepareRelease(
      modpack,
      first.release.id,
      first.manifest,
    );
    const second = await seedRelease(modpack, "1.1.0", [known, unknown]);

    await launcherPackService.prepareRelease(
      modpack,
      second.release.id,
      second.manifest,
    );
    await launcherPackService.prepareRelease(
      modpack,
      second.release.id,
      second.manifest,
    );

    expect(await isReady(second.release.id)).toBe(false);
    expect((await launcherPackService.getLatestPack()).version).toBe("1.0.0");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      String(unknown.fileId),
    );
  });

  it("becomes ready on a later attempt once the missing file resolves", async () => {
    const modpack = await seedPack();
    const late = await seedFile();
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [late]);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    expect(await isReady(release.id)).toBe(false);

    serveFromCurseForge([late]);
    packZip(manifest.fileId);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await isReady(release.id)).toBe(true);
  });

  it("does not store a blocked file as manual while Modrinth cannot be asked", async () => {
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    vi.mocked(findModrinthFilesBySha1).mockRejectedValue(
      new Error("Modrinth version_files failed (503)"),
    );
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await expect(
      launcherPackService.prepareRelease(modpack, release.id, manifest),
    ).rejects.toThrow(/503/);

    expect(await isReady(release.id)).toBe(false);
    expect(await Q.curseforge.file.find({ id: blocked.fileId })).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("is not ready when a file that was manual before cannot be looked up again", async () => {
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    await launcherPackService.resolveFiles([blocked.fileId]);
    vi.mocked(findModrinthFilesBySha1).mockRejectedValue(
      new Error("Modrinth version_files failed (503)"),
    );
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await expect(
      launcherPackService.prepareRelease(modpack, release.id, manifest),
    ).rejects.toThrow(/503/);

    expect(await isReady(release.id)).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("says so when a release is keyed by its server pack and cannot be offered", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);
    const clientRead = { ...manifest, fileId: manifest.fileId + 100_000 };

    await launcherPackService.prepareRelease(modpack, release.id, clientRead);
    await launcherPackService.prepareRelease(modpack, release.id, clientRead);

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      "server pack",
    );
  });

  it.each([
    ["no download link", { downloadUrl: null }],
    ["no SHA-1", { sha1: null }],
  ])(
    "is not ready when CurseForge gives %s for the pack zip",
    async (_label, zip) => {
      const modpack = await seedPack();
      const file = await seedFile();
      serveFromCurseForge([file]);
      const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);
      packZip(manifest.fileId, zip);

      await launcherPackService.prepareRelease(modpack, release.id, manifest);

      expect(await isReady(release.id)).toBe(false);
      expect(sendMock).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores a modpack the launcher does not install", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 1,
    });
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
  });
});

describe("LauncherPackService.getLatestPack", () => {
  it("answers PACK_UNAVAILABLE while no release is ready", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "1.0.0", [await seedFile()]);

    const error = await refusal(launcherPackService.getLatestPack());

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_UNAVAILABLE");
  });

  it("serves the newest ready release", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    for (const version of ["1.0.0", "1.1.0"]) {
      const { release, manifest } = await seedRelease(modpack, version, [file]);
      await launcherPackService.prepareRelease(modpack, release.id, manifest);
    }

    expect((await launcherPackService.getLatestPack()).version).toBe("1.1.0");
  });
});

describe("LauncherPackService.listReleases", () => {
  it("lists every ready release newest first, in the shape of the latest pack", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedRelease(modpack, "1.2.0", [file]);

    const { releases } = await launcherPackService.listReleases(FIRST_PAGE);

    expect(releases.map((release) => release.version)).toEqual([
      "1.1.0",
      "1.0.0",
    ]);
    expect(releases[0]).toEqual({
      ...(await launcherPackService.getLatestPack()),
      changelog: expect.any(Object),
    });
  });

  it("is empty while no release is ready", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "1.0.0", [await seedFile()]);

    expect(await launcherPackService.listReleases(FIRST_PAGE)).toEqual({
      releases: [],
      total: 0,
    });
  });

  it("serves the list in pages and counts only the releases it lists", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const archived = await seedReadyRelease(modpack, "0.9.0", [file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedReadyRelease(modpack, "1.2.0", [file]);
    await seedRelease(modpack, "1.3.0", [file]);
    archivedOnCurseForge([archived.manifest.fileId]);
    await launcherPackService.checkReleases(modpack);

    const first = await launcherPackService.listReleases({ page: 0, limit: 2 });
    const second = await launcherPackService.listReleases({
      page: 1,
      limit: 2,
    });
    const pastTheEnd = await launcherPackService.listReleases({
      page: 5,
      limit: 2,
    });

    expect(first.releases.map((release) => release.version)).toEqual([
      "1.2.0",
      "1.1.0",
    ]);
    expect(first.total).toBe(3);
    expect(second.releases.map((release) => release.version)).toEqual([
      "1.0.0",
    ]);
    expect(pastTheEnd).toEqual({ releases: [], total: 3 });
  });

  it("serves a release that was recorded without a version once it is made ready", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);
    await Q.modpack.release.updateAll(
      { version: null, minecraftVersion: null, modLoader: null },
      { id: release.id },
    );

    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    const listed = await launcherPackService.listReleases(FIRST_PAGE);

    expect(listed.total).toBe(1);
    expect(listed.releases).toEqual([
      expect.objectContaining({
        version: "1.0.0",
        minecraftVersion: "1.21.1",
        modLoader: expect.objectContaining({ id: "neoforge-21.1.249" }),
      }),
    ]);
  });

  it("answers a full-size page from the changelog cache the second time", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const fullPage = { page: 0, limit: LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE };
    for (let minor = 0; minor < fullPage.limit; minor++) {
      await seedReadyRelease(modpack, `1.${minor}.0`, [file]);
    }
    const diffReads = vi.spyOn(Q.modpack.release.mod, "listForReleases");

    const first = await launcherPackService.listReleases(fullPage);
    const readsForFirst = diffReads.mock.calls.length;
    await launcherPackService.listReleases(fullPage);
    const readsForBoth = diffReads.mock.calls.length;
    diffReads.mockRestore();

    expect(first.releases).toHaveLength(fullPage.limit);
    expect(readsForFirst).toBe(fullPage.limit);
    expect(readsForBoth).toBe(fullPage.limit);
  });

  it("gives each release the mods it added, updated and removed against the release before it", async () => {
    const modpack = await seedPack();
    const kept = await seedFile();
    const outdated = await seedFile();
    const updated = await seedFile({ newFileOf: outdated });
    const dropped = await seedFile();
    const fresh = await seedFile();
    serveFromCurseForge([kept, outdated, updated, dropped, fresh]);
    await seedReadyRelease(modpack, "1.0.0", [kept, outdated, dropped]);
    await seedReadyRelease(modpack, "1.1.0", [kept, updated, fresh]);

    const { releases } = await launcherPackService.listReleases(FIRST_PAGE);

    expect(releases[0].changelog).toEqual({
      previousVersion: "1.0.0",
      added: [
        {
          projectId: fresh.projectId,
          name: expect.any(String),
          url: expect.stringContaining("curseforge.com"),
          iconUrl: null,
          label: `Mod ${fresh.fileId}`,
          previousLabel: null,
          disabled: false,
        },
      ],
      updated: [
        expect.objectContaining({
          projectId: updated.projectId,
          label: `Mod ${updated.fileId}`,
          previousLabel: `Mod ${outdated.fileId}`,
        }),
      ],
      removed: [
        expect.objectContaining({
          projectId: dropped.projectId,
          label: `Mod ${dropped.fileId}`,
          previousLabel: null,
        }),
      ],
      notes: null,
    });
    expect(releases[1].changelog).toEqual({
      previousVersion: null,
      added: [],
      updated: [],
      removed: [],
      notes: null,
    });
  });

  it("carries the notes written for a release", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { manifest } = await seedReadyRelease(modpack, "1.0.0", [file]);
    await Q.modpack.publish.create({
      modpackId: modpack.id,
      clientFileId: manifest.fileId,
      notes: "Trains are faster now.\nThe nether was reset.",
    });

    const { releases } = await launcherPackService.listReleases(FIRST_PAGE);

    expect(releases[0].changelog.notes).toBe(
      "Trains are faster now.\nThe nether was reset.",
    );
  });

  it("compares a release with the one recorded before it even when that one is no longer listed", async () => {
    const modpack = await seedPack();
    const kept = await seedFile();
    const fresh = await seedFile();
    serveFromCurseForge([kept, fresh]);
    const old = await seedReadyRelease(modpack, "1.0.0", [kept]);
    await seedReadyRelease(modpack, "1.1.0", [kept, fresh]);
    archivedOnCurseForge([old.manifest.fileId]);
    await launcherPackService.checkReleases(modpack);

    const { releases } = await launcherPackService.listReleases(FIRST_PAGE);

    expect(releases.map((release) => release.version)).toEqual(["1.1.0"]);
    expect(releases[0].changelog).toEqual(
      expect.objectContaining({
        previousVersion: "1.0.0",
        added: [expect.objectContaining({ projectId: fresh.projectId })],
      }),
    );
  });
});

describe("LauncherPackService.checkReleases", () => {
  it("takes a release whose pack zip was archived out of the list, and leaves the latest pack alone", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const old = await seedReadyRelease(modpack, "1.0.0", [file]);
    const newest = await seedReadyRelease(modpack, "1.1.0", [file]);

    archivedOnCurseForge([old.manifest.fileId]);
    await launcherPackService.checkReleases(modpack);
    const afterOld = await listedVersions();
    archivedOnCurseForge([old.manifest.fileId, newest.manifest.fileId]);
    await launcherPackService.checkReleases(modpack);

    expect(afterOld).toEqual(["1.1.0"]);
    expect(await listedVersions()).toEqual([]);
    expect((await launcherPackService.getLatestPack()).version).toBe("1.1.0");
  });

  it("takes a release out of the list when one of its client files was archived", async () => {
    const modpack = await seedPack();
    const kept = await seedFile();
    const replaced = await seedFile();
    const replacement = await seedFile();
    serveFromCurseForge([kept, replaced, replacement]);
    await seedReadyRelease(modpack, "1.0.0", [kept, replaced]);
    await seedReadyRelease(modpack, "1.1.0", [kept, replacement]);

    archivedOnCurseForge([replaced.fileId]);
    await launcherPackService.checkReleases(modpack);

    expect(await listedVersions()).toEqual(["1.1.0"]);
  });

  it("asks CurseForge once about the pack zips and client files of every ready release", async () => {
    const modpack = await seedPack();
    const shared = await seedFile();
    const onlyOld = await seedFile();
    const serverOnly = await seedFile({ sides: "server" });
    serveFromCurseForge([shared, onlyOld, serverOnly]);
    const old = await seedReadyRelease(modpack, "1.0.0", [
      shared,
      onlyOld,
      serverOnly,
    ]);
    const newest = await seedReadyRelease(modpack, "1.1.0", [shared]);
    const notReady = await seedRelease(modpack, "1.2.0", [shared]);

    await launcherPackService.checkReleases(modpack);

    expect(getServedFileIds).toHaveBeenCalledTimes(1);
    const asked = vi.mocked(getServedFileIds).mock.calls[0][0];
    expect([...asked].sort()).toEqual(
      [
        old.manifest.fileId,
        newest.manifest.fileId,
        shared.fileId,
        onlyOld.fileId,
      ].sort(),
    );
    expect(asked).not.toContain(notReady.manifest.fileId);
  });

  it("keeps a release listed when only a file of its server pack was archived", async () => {
    const modpack = await seedPack();
    const client = await seedFile();
    const serverOnly = await seedFile({ sides: "server" });
    serveFromCurseForge([client, serverOnly]);
    await seedReadyRelease(modpack, "1.0.0", [client, serverOnly]);

    archivedOnCurseForge([serverOnly.fileId]);
    await launcherPackService.checkReleases(modpack);

    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("keeps a release listed when an archived server-only file was resolved by a launcher request", async () => {
    const modpack = await seedPack();
    const client = await seedFile();
    const serverOnly = await seedFile({ sides: "server" });
    serveFromCurseForge([client, serverOnly]);
    await seedReadyRelease(modpack, "1.0.0", [client, serverOnly]);
    const resolved = await launcherPackService.resolveFiles([
      serverOnly.fileId,
    ]);

    archivedOnCurseForge([serverOnly.fileId]);
    await launcherPackService.checkReleases(modpack);

    expect(resolved.files.map((file) => file.fileId)).toEqual([
      serverOnly.fileId,
    ]);
    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("lets only the pack zip decide for a release recorded without sides", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedReadyRelease(modpack, "1.0.0", [
      file,
    ]);
    await Q.modpack.release.mod.updateAll(
      { inClientPack: null },
      { releaseId: release.id },
    );

    archivedOnCurseForge([file.fileId]);
    await launcherPackService.checkReleases(modpack);
    const afterFile = await listedVersions();
    archivedOnCurseForge([manifest.fileId]);
    await launcherPackService.checkReleases(modpack);

    expect(afterFile).toEqual(["1.0.0"]);
    expect(await listedVersions()).toEqual([]);
  });

  it("lists a release again once CurseForge serves its files again", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { manifest } = await seedReadyRelease(modpack, "1.0.0", [file]);
    archivedOnCurseForge([manifest.fileId]);
    await launcherPackService.checkReleases(modpack);
    const whileArchived = await listedVersions();

    archivedOnCurseForge([]);
    await launcherPackService.checkReleases(modpack);

    expect(whileArchived).toEqual([]);
    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("changes nothing when CurseForge cannot be asked", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(getServedFileIds).mockRejectedValue(new Error("CurseForge 504"));

    await expect(launcherPackService.checkReleases(modpack)).rejects.toThrow(
      /504/,
    );

    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("ignores a modpack the launcher does not install", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 1,
    });

    await launcherPackService.checkReleases(modpack);

    expect(getServedFileIds).not.toHaveBeenCalled();
  });
});

describe("LauncherPackService.resolveFiles", () => {
  it("resolves and stores a file no release ships, caching its project first", async () => {
    const file = await seedFile();
    await Q.curseforge.project.deleteAll({ id: file.projectId });
    serveFromCurseForge([file]);
    ingestFromCurseForge(new Map([[file.projectId, 6]]));

    const first = await launcherPackService.resolveFiles([file.fileId]);
    const second = await launcherPackService.resolveFiles([file.fileId]);

    expect(ingestProjectsWhere).toHaveBeenCalledWith(
      [file.projectId],
      expect.any(Function),
    );
    expect(first.files).toEqual([
      expect.objectContaining({ fileId: file.fileId, source: "curseforge" }),
    ]);
    expect(second).toEqual(first);
    expect(getFilesDetails).toHaveBeenCalledTimes(1);
  });

  it("does not cache the project of a file the launcher cannot install", async () => {
    const dataPack = await seedFile({ classId: 6945 });
    await Q.curseforge.project.deleteAll({ id: dataPack.projectId });
    serveFromCurseForge([dataPack]);
    ingestFromCurseForge(new Map([[dataPack.projectId, 6945]]));

    const resolved = await launcherPackService.resolveFiles([dataPack.fileId]);

    expect(resolved.unresolvedFileIds).toEqual([dataPack.fileId]);
    expect(
      await Q.curseforge.project.find({ id: dataPack.projectId }),
    ).toBeNull();
  });

  it("lists the ids it cannot serve as unresolved", async () => {
    const good = await seedFile();
    const unknown = await seedFile();
    const dataPack = await seedFile({ classId: 6945 });
    const noHash = await seedFile({ detail: { sha1: null } });
    const otherGame = await seedFile({ detail: { gameId: 1 } });
    serveFromCurseForge([good, dataPack, noHash, otherGame]);

    const resolved = await launcherPackService.resolveFiles([
      good.fileId,
      unknown.fileId,
      dataPack.fileId,
      noHash.fileId,
      otherGame.fileId,
    ]);

    expect(resolved.files.map((file) => file.fileId)).toEqual([good.fileId]);
    expect(resolved.unresolvedFileIds).toEqual([
      unknown.fileId,
      dataPack.fileId,
      noHash.fileId,
      otherGame.fileId,
    ]);
  });

  it("answers FILE_SOURCES_UNAVAILABLE when a new file cannot be looked up", async () => {
    const file = await seedFile();
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    const error = await refusal(
      launcherPackService.resolveFiles([file.fileId]),
    );

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("FILE_SOURCES_UNAVAILABLE");
  });

  it("looks a manual file up again after an hour and picks up a new source", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    serveFromModrinth([file]);

    const withinTheHour = await launcherPackService.resolveFiles([file.fileId]);
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date(Date.now() - 2 * HOUR_MS) },
      { id: file.fileId },
    );
    const afterTheHour = await launcherPackService.resolveFiles([file.fileId]);

    expect(withinTheHour.files[0].source).toBe("manual");
    expect(afterTheHour.files[0]).toEqual(
      expect.objectContaining({
        source: "modrinth",
        url: modrinthUrl(file.fileId),
      }),
    );
  });

  it("checks a built address again after a day and falls through when it stopped answering", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    serveFromBuiltCdnAddress([]);

    await ageStoredFile(file.fileId, 23 * HOUR_MS);
    const withinTheDay = await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);
    const afterTheDay = await launcherPackService.resolveFiles([file.fileId]);

    expect(withinTheDay.files[0]).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
    expect(afterTheDay.files[0]).toEqual(
      expect.objectContaining({ source: "manual", url: null }),
    );
  });

  it("keeps a built address that still answers at the daily check", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);

    const resolved = await launcherPackService.resolveFiles([file.fileId]);

    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(2);
    expect(resolved.files[0]).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("resolves a file stored with the built address again as soon as the source is switched off", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    const whileOn = await launcherPackService.resolveFiles([file.fileId]);
    serveFromSandbox([file]);

    await useBuiltCdnAddress(false);
    const whileOff = await launcherPackService.resolveFiles([file.fileId]);

    expect(whileOn.files[0].source).toBe("curseforge-cdn");
    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(1);
    expect(whileOff.files[0]).toEqual(
      expect.objectContaining({
        source: "storage",
        url: sandboxUrl(file.fileId),
      }),
    );
  });

  it("stops handing out the built address once the source is switched off, even while CurseForge cannot be asked", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    await useBuiltCdnAddress(false);
    const resolved = await launcherPackService.resolveFiles([file.fileId]);

    expect(resolved.files[0]).toEqual(
      expect.objectContaining({ source: "manual", url: null }),
    );
  });

  it("leaves a stored built address alone while the flag cannot be read", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    const late = await seedFile({ blocked: true });
    serveFromCurseForge([file, late]);
    serveFromBuiltCdnAddress([file, late]);
    await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);

    await useBuiltCdnAddress(true);
    vi.spyOn(Q.feature.flag, "find").mockRejectedValueOnce(
      new Error("Connection terminated unexpectedly"),
    );
    const resolved = await launcherPackService.resolveFiles([
      file.fileId,
      late.fileId,
    ]);

    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(1);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: file.fileId,
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
      expect.objectContaining({
        fileId: late.fileId,
        source: "manual",
        url: null,
      }),
    ]);
  });

  it("keeps serving the built address when the daily check cannot ask CurseForge", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    const resolved = await launcherPackService.resolveFiles([file.fileId]);

    expect(resolved.files[0]).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("keeps serving a manual file as manual when the second lookup fails", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date(Date.now() - 2 * HOUR_MS) },
      { id: file.fileId },
    );
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    const resolved = await launcherPackService.resolveFiles([file.fileId]);

    expect(resolved.files[0].source).toBe("manual");
  });
});
