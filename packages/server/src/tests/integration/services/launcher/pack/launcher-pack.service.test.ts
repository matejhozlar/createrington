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
  refreshProjects: vi.fn(async () => 0),
}));
vi.mock("@/services/modrinth", () => ({
  findModrinthFilesBySha1: vi.fn(async () => new Map()),
}));
vi.mock("@/services/launcher/pack/curseforge-cdn", () => ({
  findCurseforgeCdnUrls: vi.fn(async () => new Map()),
}));
vi.mock("@/services/launcher/pack/sandbox-files", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/launcher/pack/sandbox-files")
  >()),
  findSandboxFileUrls: vi.fn(async () => new Map()),
  findSandboxSnapshotUrl: vi.fn(async () => null),
  openSandboxFile: vi.fn(async () => null),
}));
vi.mock("@/utils/mojang-java-version", () => ({
  getMinecraftJavaMajorVersion: vi.fn(async () => 21),
}));

import config from "@/config";
import pool, { Q } from "@/db";
import type {
  LauncherPack,
  LauncherPackCreate,
} from "@createrington/shared/db";
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
import {
  ingestProjectsWhere,
  refreshProjects,
} from "@/services/curseforge/ingest";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import { findCurseforgeCdnUrls } from "@/services/launcher/pack/curseforge-cdn";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import {
  findSandboxFileUrls,
  openSandboxFile,
  SandboxUnavailableError,
} from "@/services/launcher/pack/sandbox-files";
import { findModrinthFilesBySha1 } from "@/services/modrinth";
import { settings } from "@/services/settings";
import { NotFoundError } from "@/db/utils";
import { getMinecraftJavaMajorVersion } from "@/utils/mojang-java-version";
import type {
  CurseforgeProjectCreate,
  Modpack,
  ModpackRelease,
} from "@createrington/shared/db";
import {
  cleanupLauncherPacks,
  seedLauncherPack,
} from "@/tests/helpers/launcher-pack";
import { LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE } from "@createrington/shared/launcher";
import {
  cleanupWorkshopTestContext,
  createWorkshopTestContext,
  makeProjectData,
  seedModpack,
  seedProject,
} from "@/tests/helpers/workshop";

const PACK_PROJECT_ID = 995_900_001;
const PACK_SLUG = "vitest";
const PACK_ORDER_FOR_TESTS = {
  orderBy: "position",
  orderDirection: "asc",
} as const;
const HOUR_MS = 60 * 60 * 1000;
const FIRST_PAGE = { page: 0, limit: 25 };
const PACK_ON_CURSEFORGE = {
  classId: 4471,
  slug: "vitest-pack",
  name: "Vitest Pack on CurseForge",
  summary: "A synthetic test pack",
  thumbnailUrl: "https://media.forgecdn.net/avatars/vitest-pack.png",
  websiteUrl: "https://www.curseforge.com/minecraft/modpacks/vitest-pack",
  primaryAuthor: "vitest",
};

const ctx = createWorkshopTestContext(995_000_000);
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
const storageUrl = (fileId: number) =>
  expect.stringMatching(new RegExp(`/api/launcher/packs/files/${fileId}$`));
const storageSnapshotUrl = (snapshotId: number) =>
  expect.stringMatching(
    new RegExp(`/api/launcher/packs/files/snapshot/${snapshotId}$`),
  );

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
  (await launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE)).releases.map(
    (release) => release.version,
  );

const packProject = (projectId = PACK_PROJECT_ID) => ({
  source: "curseforge",
  id: String(projectId),
  slug: "vitest-pack",
  kind: "modpack",
  name: "Vitest Pack on CurseForge",
  summary: "A synthetic test pack",
  author: "vitest",
  iconUrl: "https://media.forgecdn.net/avatars/vitest-pack.png",
  url: "https://www.curseforge.com/minecraft/modpacks/vitest-pack",
});

async function seedPackProject(
  projectId = PACK_PROJECT_ID,
  overrides: Partial<CurseforgeProjectCreate> = {},
): Promise<void> {
  await Q.curseforge.project.create({
    id: projectId,
    ...PACK_ON_CURSEFORGE,
    ...overrides,
  });
  ctx.projectIds.push(projectId);
}

async function offerToLauncher(
  modpack: Modpack,
  overrides: Partial<LauncherPackCreate> = {},
): Promise<LauncherPack> {
  return seedLauncherPack(ctx, {
    slug: PACK_SLUG,
    modpackId: modpack.id,
    source: "curseforge",
    ...overrides,
  });
}

async function seedPack(
  project: Partial<CurseforgeProjectCreate> = {},
  pack: Partial<LauncherPackCreate> = {},
): Promise<Modpack> {
  await seedPackProject(PACK_PROJECT_ID, project);
  const modpack = await seedModpack(ctx, {
    name: "Vitest Pack",
    curseforgeProjectId: PACK_PROJECT_ID,
  });
  await offerToLauncher(modpack, pack);
  return modpack;
}

async function seedPackWithoutProject(projectId: number): Promise<Modpack> {
  const modpack = await seedModpack(ctx, {
    name: "Vitest Pack",
    curseforgeProjectId: projectId,
  });
  await offerToLauncher(modpack);
  return modpack;
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
  vi.mocked(getFilesDetails).mockResolvedValue([]);
  vi.mocked(getModpackFile).mockResolvedValue(null);
  archivedOnCurseForge([]);
  vi.mocked(ingestProjectsWhere).mockResolvedValue(0);
  vi.mocked(refreshProjects).mockResolvedValue(0);
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
  await cleanupLauncherPacks(ctx);
  await cleanupWorkshopTestContext(ctx);
  await useBuiltCdnAddress(false);
  vi.resetAllMocks();
});

afterAll(async () => {
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

    expect(await launcherPackService.getLatestPack(PACK_SLUG)).toEqual({
      project: packProject(),
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
        servedBy: "curseforge",
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stores each client file with its source, folder and CurseForge hash", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    await Q.curseforge.project.updateAll(
      {
        summary: "A synthetic test project",
        thumbnailUrl: "https://media.forgecdn.net/avatars/vitest.png",
        primaryAuthor: "vitest",
      },
      { id: served.projectId },
    );
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
        file: {
          source: "curseforge",
          projectId: String(served.projectId),
          id: String(served.fileId),
          fileName: `mod-${served.fileId}.jar`,
          size: served.detail.fileLength,
          sha1: sha1Of(served.fileId),
          pageUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${served.fileId}/files/${served.fileId}`,
          download: { servedBy: "curseforge", url: cdnUrl(served.fileId) },
        },
        project: {
          source: "curseforge",
          id: String(served.projectId),
          slug: `vitest-mod-${served.projectId}`,
          kind: "mod",
          name: `Vitest Mod ${served.projectId}`,
          summary: "A synthetic test project",
          author: "vitest",
          iconUrl: "https://media.forgecdn.net/avatars/vitest.png",
          url: `https://www.curseforge.com/minecraft/mc-mods/vitest-${served.fileId}`,
        },
      },
      expect.objectContaining({
        fileId: onModrinth.fileId,
        sha1: sha1Of(onModrinth.fileId),
        folder: "mods",
        source: "modrinth",
        url: modrinthUrl(onModrinth.fileId),
        file: expect.objectContaining({
          source: "curseforge",
          id: String(onModrinth.fileId),
          download: {
            servedBy: "modrinth",
            url: modrinthUrl(onModrinth.fileId),
          },
        }),
        project: expect.objectContaining({
          source: "curseforge",
          id: String(onModrinth.projectId),
          summary: null,
          author: null,
          iconUrl: null,
        }),
      }),
      expect.objectContaining({
        fileId: shader.fileId,
        folder: "shaderpacks",
        source: "curseforge",
        project: expect.objectContaining({ kind: "shader" }),
      }),
      expect.objectContaining({
        fileId: resourcePack.fileId,
        folder: "resourcepacks",
        source: "curseforge",
        project: expect.objectContaining({ kind: "resourcepack" }),
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
        url: storageUrl(onSandbox.fileId),
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
        url: storageUrl(blocked.fileId),
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
    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.0.0",
    );
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

    const error = await refusal(launcherPackService.getLatestPack(PACK_SLUG));

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

    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.1.0",
    );
  });

  it("names the pack as CurseForge does, not as the app does", async () => {
    const modpack = await seedPack({
      name: "Rails 'n Sails",
      summary: null,
      thumbnailUrl: null,
      primaryAuthor: null,
    });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);

    const { project } = await launcherPackService.getLatestPack(PACK_SLUG);

    expect(modpack.name).toBe("Vitest Pack");
    expect(project).toEqual({
      ...packProject(),
      name: "Rails 'n Sails",
      summary: null,
      author: null,
      iconUrl: null,
    });
    expect(refreshProjects).not.toHaveBeenCalled();
  });

  it("stores the pack's project from CurseForge when it is not stored yet", async () => {
    const projectId = PACK_PROJECT_ID + 10;
    const modpack = await seedPackWithoutProject(projectId);
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockImplementation(async ([id]) => {
      await seedPackProject(id);
      return 1;
    });

    const [first, second] = await Promise.all([
      launcherPackService.getLatestPack(PACK_SLUG),
      launcherPackService.getLatestPack(PACK_SLUG),
    ]);

    expect(first.project).toEqual(packProject(projectId));
    expect(second).toEqual(first);
    expect(refreshProjects).toHaveBeenCalledTimes(1);
    expect(refreshProjects).toHaveBeenCalledWith([projectId]);
  });

  it("does not serve the pack while its project cannot be stored, and asks CurseForge once", async () => {
    const modpack = await seedPackWithoutProject(PACK_PROJECT_ID + 11);
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockRejectedValue(new Error("CurseForge 504"));

    const error = await refusal(launcherPackService.getLatestPack(PACK_SLUG));
    const listed = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_UNAVAILABLE");
    expect(listed).toEqual({ releases: [], total: 0 });
    expect(refreshProjects).toHaveBeenCalledTimes(1);
  });

  it("does not serve a pack whose CurseForge project is not a modpack", async () => {
    const modpack = await seedPack({ classId: 6 });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);

    const error = await refusal(launcherPackService.getLatestPack(PACK_SLUG));

    expect(error.code).toBe("PACK_UNAVAILABLE");
    expect(
      await launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE),
    ).toEqual({
      releases: [],
      total: 0,
    });
  });
});

describe("LauncherPackService.getLatestPack for a pack the launcher is not offered", () => {
  it("answers PACK_NOT_FOUND for a slug no pack carries", async () => {
    await seedPack();

    const error = await refusal(launcherPackService.getLatestPack("nope"));

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_NOT_FOUND");
  });

  it("answers PACK_NOT_FOUND for a pack the owner switched off, and lists no release of it", async () => {
    const modpack = await seedPack({}, { enabled: false });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);

    const latest = await refusal(launcherPackService.getLatestPack(PACK_SLUG));
    const releases = await refusal(
      launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE),
    );

    expect(latest.code).toBe("PACK_NOT_FOUND");
    expect(releases.code).toBe("PACK_NOT_FOUND");
  });

  it("still prepares the releases of a pack the owner switched off", async () => {
    const modpack = await seedPack({}, { enabled: false });
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    await Q.launcher.pack.updateAll(
      { enabled: true },
      { modpackId: modpack.id },
    );

    expect(await isReady(release.id)).toBe(true);
    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.0.0",
    );
  });

  it("describes a pack whose releases the sandbox reports by its modpack row, never by CurseForge", async () => {
    const modpack = await seedModpack(ctx, {
      name: "Vitest Test Server",
      description: "Where the next release is tried",
      iconUrl: "https://assets.createrington.test/icons/test.png",
      curseforgeProjectId: PACK_PROJECT_ID + 3,
    });
    await offerToLauncher(modpack, { slug: "vitest-test", source: "sandbox" });

    const latest = await refusal(
      launcherPackService.getLatestPack("vitest-test"),
    );
    const listed = await launcherPackService.listReleases(
      "vitest-test",
      FIRST_PAGE,
    );
    const [summary] = await launcherPackService.listPacks();

    expect(latest.code).toBe("PACK_UNAVAILABLE");
    expect(listed).toEqual({ releases: [], total: 0 });
    expect(summary).toMatchObject({
      slug: "vitest-test",
      source: "sandbox",
      name: "Vitest Test Server",
      summary: "Where the next release is tried",
      iconUrl: "https://assets.createrington.test/icons/test.png",
      latest: null,
    });
    expect(refreshProjects).not.toHaveBeenCalled();
  });

  it("does not prepare the releases of a pack whose releases the sandbox reports", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 2,
    });
    await offerToLauncher(modpack, { slug: "vitest-test", source: "sandbox" });
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    await launcherPackService.checkReleases(modpack);

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(getServedFileIds).not.toHaveBeenCalled();
  });
});

describe("LauncherPackService.prepareSnapshot", () => {
  const SNAPSHOT_ZIP = {
    fileName: "createrington-test-7.zip",
    size: 4321,
    sha1: "a".repeat(40),
    downloadUrl: "https://sandbox.createrington.test/api/pack/files/snapshot/7",
  };

  async function seedSandboxPack(): Promise<Modpack> {
    const modpack = await seedModpack(ctx, {
      name: "Vitest Test Server",
      description: "Where the next release is tried",
      iconUrl: "https://assets.createrington.test/icons/test.png",
    });
    await offerToLauncher(modpack, { slug: "vitest-test", source: "sandbox" });
    return modpack;
  }

  async function seedSnapshot(
    modpack: Modpack,
    snapshotId: number,
    version: string,
    files: SeededFile[],
  ): Promise<ModpackRelease> {
    const release = await Q.modpack.release.createAndReturn({
      modpackId: modpack.id,
      curseforgeFileId: snapshotId,
      version,
      minecraftVersion: "1.21.1",
      modLoader: "neoforge-21.1.249",
      modCount: files.length,
      publishedAt: new Date(),
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
        inClientPack: true,
      })),
    );
    return release;
  }

  const entriesOf = (files: SeededFile[]) =>
    files.map(({ projectId, fileId, required }) => ({
      projectId,
      fileId,
      required,
    }));

  it("readies a snapshot and serves it as the pack's latest release, described by the modpack row", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const release = await seedSnapshot(modpack, 7, "1.4.2-test.7", [file]);

    const outcome = await launcherPackService.prepareSnapshot(
      modpack,
      release.id,
      {
        version: "1.4.2-test.7",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      },
    );

    expect(outcome).toEqual({ status: "ready" });
    const latest = await launcherPackService.getLatestPack("vitest-test");
    expect(latest).toEqual({
      project: {
        source: "createrington",
        id: String(modpack.id),
        slug: "vitest-test",
        kind: "modpack",
        name: "Vitest Test Server",
        summary: "Where the next release is tried",
        author: null,
        iconUrl: "https://assets.createrington.test/icons/test.png",
        url: expect.stringMatching(/^https?:\/\//),
      },
      version: "1.4.2-test.7",
      releasedAt: expect.any(String),
      minecraftVersion: "1.21.1",
      modLoader: {
        id: "neoforge-21.1.249",
        name: "neoforge",
        version: "21.1.249",
      },
      javaMajorVersion: 21,
      zip: {
        fileId: 7,
        fileName: SNAPSHOT_ZIP.fileName,
        url: storageSnapshotUrl(7),
        size: SNAPSHOT_ZIP.size,
        sha1: SNAPSHOT_ZIP.sha1,
        servedBy: "storage",
      },
    });
    const [summary] = await launcherPackService.listPacks();
    expect(summary.latest).toEqual(latest);
    expect(getFilesDetails).toHaveBeenCalledWith([file.fileId]);
  });

  describe("openStorageSnapshot", () => {
    const stream = () => ({
      body: new Blob([Buffer.from("zip bytes")]).stream(),
      size: SNAPSHOT_ZIP.size,
    });

    async function readySnapshot(id: number): Promise<Modpack> {
      const modpack = await seedSandboxPack();
      const file = await seedFile();
      serveFromCurseForge([file]);
      const release = await seedSnapshot(modpack, id, `test.${id}`, [file]);
      await launcherPackService.prepareSnapshot(modpack, release.id, {
        version: `test.${id}`,
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      });
      return modpack;
    }

    it("opens the zip of a readied snapshot on the sandbox, named and sized from the release", async () => {
      await readySnapshot(7);
      vi.mocked(openSandboxFile).mockResolvedValue(stream());
      const signal = new AbortController().signal;

      const download = await launcherPackService.openStorageSnapshot(7, signal);

      expect(openSandboxFile).toHaveBeenCalledWith(
        "snapshot/7",
        SNAPSHOT_ZIP.size,
        signal,
      );
      expect(download.fileName).toBe(SNAPSHOT_ZIP.fileName);
      expect(download.size).toBe(SNAPSHOT_ZIP.size);
      expect(await new Response(download.body).text()).toBe("zip bytes");
    });

    it("refuses a snapshot that is recorded but not ready, without asking the sandbox", async () => {
      const modpack = await seedSandboxPack();
      await seedSnapshot(modpack, 7, "test.7", [await seedFile()]);

      await expect(
        launcherPackService.openStorageSnapshot(
          7,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
      expect(openSandboxFile).not.toHaveBeenCalled();
    });

    it("refuses a snapshot id no sandbox pack carries", async () => {
      await readySnapshot(7);

      await expect(
        launcherPackService.openStorageSnapshot(
          8,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
      expect(openSandboxFile).not.toHaveBeenCalled();
    });

    it("says the zip is not found when the sandbox no longer keeps it", async () => {
      await readySnapshot(7);
      vi.mocked(openSandboxFile).mockResolvedValue(null);

      await expect(
        launcherPackService.openStorageSnapshot(
          7,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    });

    it("says the zip cannot be served while the sandbox fails", async () => {
      await readySnapshot(7);
      vi.mocked(openSandboxFile).mockRejectedValue(
        new SandboxUnavailableError("The sandbox answered 500 for snapshot/7"),
      );

      await expect(
        launcherPackService.openStorageSnapshot(
          7,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 502, code: "FILE_UNAVAILABLE" });
    });
  });

  it("retires every older snapshot so only the newest is installable", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const snapshot = async (id: number, version: string) => {
      const release = await seedSnapshot(modpack, id, version, [file]);
      await launcherPackService.prepareSnapshot(modpack, release.id, {
        version,
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: {
          ...SNAPSHOT_ZIP,
          downloadUrl: `${SNAPSHOT_ZIP.downloadUrl}-${id}`,
        },
        entries: entriesOf([file]),
      });
      return release;
    };
    const first = await snapshot(7, "test.7");
    const second = await snapshot(8, "test.8");

    const listed = await launcherPackService.listReleases(
      "vitest-test",
      FIRST_PAGE,
    );

    expect(listed.total).toBe(1);
    expect(listed.releases.map((release) => release.version)).toEqual([
      "test.8",
    ]);
    expect(
      (await Q.modpack.release.get({ id: first.id })).launcherUnavailableAt,
    ).not.toBeNull();
    expect(
      (await Q.modpack.release.get({ id: second.id })).launcherUnavailableAt,
    ).toBeNull();
    expect(
      (await launcherPackService.getLatestPack("vitest-test")).version,
    ).toBe("test.8");
  });

  it("does not ready a snapshot whose loader cannot be read, and tells the owner", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const release = await seedSnapshot(modpack, 9, "test.9", [file]);

    const outcome = await launcherPackService.prepareSnapshot(
      modpack,
      release.id,
      {
        version: "test.9",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      },
    );

    expect(outcome).toEqual({
      status: "blocked",
      reason: 'its mod loader "neoforge" does not name a loader and a version',
    });
    expect(await isReady(release.id)).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sendMock.mock.calls[0][0])).toContain(
      "report the snapshot again",
    );
    const error = await refusal(
      launcherPackService.getLatestPack("vitest-test"),
    );
    expect(error.code).toBe("PACK_UNAVAILABLE");
  });

  it("does not ready a snapshot with a client file CurseForge does not know", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    const release = await seedSnapshot(modpack, 10, "test.10", [file]);

    const outcome = await launcherPackService.prepareSnapshot(
      modpack,
      release.id,
      {
        version: "test.10",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      },
    );

    expect(outcome).toMatchObject({
      status: "blocked",
      reason: expect.stringContaining("could not be resolved on CurseForge"),
    });
    expect(await isReady(release.id)).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("LauncherPackService.listPacks", () => {
  it("lists the enabled packs in the owner's order, each with its newest ready release", async () => {
    const main = await seedPack({}, { position: 2 });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(main, "1.0.0", [file]);
    await seedReadyRelease(main, "1.1.0", [file]);
    const serverId = (await Q.server.getAll({ limit: 1 }))[0]?.id ?? null;
    const test = await seedModpack(ctx, {
      name: "Vitest Test Server",
      description: "Where the next release is tried",
      serverId,
    });
    await offerToLauncher(test, {
      slug: "vitest-test",
      source: "sandbox",
      position: 1,
    });
    const hidden = await seedModpack(ctx, { name: "Vitest Hidden" });
    await offerToLauncher(hidden, {
      slug: "vitest-hidden",
      source: "sandbox",
      enabled: false,
    });

    const packs = await launcherPackService.listPacks();

    expect(packs.map((pack) => pack.slug)).toEqual(["vitest-test", PACK_SLUG]);
    expect(packs[0]).toEqual({
      slug: "vitest-test",
      source: "sandbox",
      name: "Vitest Test Server",
      summary: "Where the next release is tried",
      iconUrl: null,
      server:
        serverId === null ? null : expect.objectContaining({ id: serverId }),
      latest: null,
    });
    expect(packs[1]).toMatchObject({
      slug: PACK_SLUG,
      source: "curseforge",
      name: PACK_ON_CURSEFORGE.name,
      summary: PACK_ON_CURSEFORGE.summary,
      iconUrl: PACK_ON_CURSEFORGE.thumbnailUrl,
      server: null,
    });
    expect(packs[1].latest).toEqual(
      await launcherPackService.getLatestPack(PACK_SLUG),
    );
    expect(packs[1].latest?.version).toBe("1.1.0");
  });

  it("describes a CurseForge pack from its modpack row while its project cannot be served, without a release", async () => {
    const modpack = await seedPackWithoutProject(PACK_PROJECT_ID + 12);
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockRejectedValue(new Error("CurseForge 504"));

    const packs = await launcherPackService.listPacks();

    expect(packs).toEqual([
      {
        slug: PACK_SLUG,
        source: "curseforge",
        name: "Vitest Pack",
        summary: null,
        iconUrl: null,
        server: null,
        latest: null,
      },
    ]);
  });

  it("lists a pack without a release with latest null", async () => {
    await seedPack();

    const [pack] = await launcherPackService.listPacks();

    expect(pack.name).toBe(PACK_ON_CURSEFORGE.name);
    expect(pack.latest).toBeNull();
  });
});

describe("LauncherPackService.seedDefaultPack", () => {
  const originalPackProjectId = config.curseforge.modpackProjectId;
  const SEEDED_KEY = "launcher_packs_seeded";
  let storedPacks: LauncherPack[] = [];
  let storedSeeded: Record<string, unknown> | null = null;

  beforeEach(async () => {
    storedPacks = await Q.launcher.pack.getAll();
    await Q.launcher.pack.deleteAll({
      id: { $in: storedPacks.map((p) => p.id) },
    });
    storedSeeded =
      (await Q.app.setting.find({ key: SEEDED_KEY }))?.value ?? null;
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
  });

  afterEach(async () => {
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      originalPackProjectId;
    await Q.launcher.pack.deleteAll({ slug: "createrington" });
    for (const pack of storedPacks) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...row } = pack;
      await Q.launcher.pack.create(row);
    }
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
    if (storedSeeded !== null) {
      await Q.app.setting.create({ key: SEEDED_KEY, value: storedSeeded });
    }
  });

  it("does not seed again after the owner removed every pack", async () => {
    await seedPackProject(PACK_PROJECT_ID);
    await seedModpack(ctx, { curseforgeProjectId: PACK_PROJECT_ID });
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;
    await launcherPackService.seedDefaultPack();
    await Q.launcher.pack.deleteAll({ slug: "createrington" });

    await launcherPackService.seedDefaultPack();

    expect(await Q.launcher.pack.count()).toBe(0);
    expect(await settings.getLauncherPacksSeeded()).toBe(true);
  });

  it("seeds on a later start once a modpack carries the configured project", async () => {
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;
    await launcherPackService.seedDefaultPack();
    expect(await settings.getLauncherPacksSeeded()).toBe(false);
    await seedPackProject(PACK_PROJECT_ID);
    await seedModpack(ctx, { curseforgeProjectId: PACK_PROJECT_ID });

    await launcherPackService.seedDefaultPack();

    expect((await Q.launcher.pack.getAll()).map((p) => p.slug)).toEqual([
      "createrington",
    ]);
  });

  it("offers the modpack linked to the configured project as the createrington pack", async () => {
    await seedPackProject(PACK_PROJECT_ID);
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID,
    });
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;

    await launcherPackService.seedDefaultPack();

    const packs = await Q.launcher.pack.getAll();
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({
      slug: "createrington",
      modpackId: modpack.id,
      source: "curseforge",
      enabled: true,
    });
    expect((await launcherPackService.listPacks()).map((p) => p.slug)).toEqual([
      "createrington",
    ]);
  });

  it("does nothing while no modpack carries the configured project", async () => {
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID + 99;

    await launcherPackService.seedDefaultPack();

    expect(await Q.launcher.pack.count()).toBe(0);
  });

  it("does nothing once any pack is stored", async () => {
    await seedPackProject(PACK_PROJECT_ID);
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID,
    });
    const other = await seedModpack(ctx, { name: "Vitest Other" });
    await offerToLauncher(other, { slug: "vitest-other", source: "sandbox" });
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;

    await launcherPackService.seedDefaultPack();

    const packs = await Q.launcher.pack.getAll();
    expect(packs.map((p) => p.slug)).toEqual(["vitest-other"]);
    expect(packs[0].modpackId).not.toBe(modpack.id);
    expect(await settings.getLauncherPacksSeeded()).toBe(true);
  });
});

describe("LauncherPackService owner methods", () => {
  const SEEDED_KEY = "launcher_packs_seeded";
  let storedSeeded: Record<string, unknown> | null = null;

  beforeEach(async () => {
    storedSeeded =
      (await Q.app.setting.find({ key: SEEDED_KEY }))?.value ?? null;
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
  });

  afterEach(async () => {
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
    if (storedSeeded !== null) {
      await Q.app.setting.create({ key: SEEDED_KEY, value: storedSeeded });
    }
  });

  const owned = async () =>
    (await launcherPackService.listOwned()).filter((pack) =>
      ctx.modpackIds.includes(pack.modpackId),
    );

  it("adds a pack last in the list and records that a pack was stored", async () => {
    const first = await seedPack();
    const test = await seedModpack(ctx, { name: "Vitest Test Server" });

    const added = await launcherPackService.addPack({
      slug: "vitest-test",
      modpackId: test.id,
      source: "sandbox",
    });

    const packs = await owned();
    expect(added).toMatchObject({
      slug: "vitest-test",
      modpackId: test.id,
      source: "sandbox",
      enabled: true,
    });
    expect(packs.map((pack) => pack.slug)).toEqual([PACK_SLUG, "vitest-test"]);
    expect(packs[1].position).toBeGreaterThan(packs[0].position);
    expect(packs[0].modpack).toEqual({
      id: first.id,
      name: first.name,
      curseforgeProjectId: PACK_PROJECT_ID,
      serverId: null,
    });
    expect(await settings.getLauncherPacksSeeded()).toBe(true);
  });

  it("refuses a CurseForge pack for a modpack without a project", async () => {
    const modpack = await seedModpack(ctx, { name: "Vitest Unlinked" });

    await expect(
      launcherPackService.addPack({
        slug: "vitest-unlinked",
        modpackId: modpack.id,
        source: "curseforge",
      }),
    ).rejects.toThrow(/no CurseForge project/);

    expect(await Q.launcher.pack.find({ slug: "vitest-unlinked" })).toBeNull();
  });

  it("refuses a slug that is taken and a modpack that is already offered", async () => {
    const modpack = await seedPack();
    const other = await seedModpack(ctx, { name: "Vitest Other" });

    await expect(
      launcherPackService.addPack({
        slug: PACK_SLUG,
        modpackId: other.id,
        source: "sandbox",
      }),
    ).rejects.toThrow(/already offers a pack as "vitest"/);
    await expect(
      launcherPackService.addPack({
        slug: "vitest-again",
        modpackId: modpack.id,
        source: "curseforge",
      }),
    ).rejects.toThrow(/already offers "Vitest Pack"/);
  });

  it("refuses to add a pack for a modpack that does not exist", async () => {
    await expect(
      launcherPackService.addPack({
        slug: "vitest-ghost",
        modpackId: 999_999_999,
        source: "sandbox",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("lists the modpacks the launcher is not offered yet", async () => {
    const offered = await seedPack();
    const free = await seedModpack(ctx, { name: "Vitest Free" });

    const candidates = await launcherPackService.listCandidates();
    const ids = candidates.map((modpack) => modpack.id);

    expect(ids).toContain(free.id);
    expect(ids).not.toContain(offered.id);
  });

  it("hides and shows a pack without touching its releases", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    const [pack] = await owned();

    const hidden = await launcherPackService.setPackEnabled(pack.id, false);
    const listedWhileHidden = await launcherPackService.listPacks();
    const shown = await launcherPackService.setPackEnabled(pack.id, true);

    expect(hidden.enabled).toBe(false);
    expect(listedWhileHidden.map((p) => p.slug)).not.toContain(PACK_SLUG);
    expect(shown.enabled).toBe(true);
    expect((await owned())[0].latestVersion).toBe("1.0.0");
  });

  it("refuses to hide a pack that does not exist", async () => {
    await expect(
      launcherPackService.setPackEnabled(999_999_999, false),
    ).rejects.toThrow(NotFoundError);
  });

  it("puts the packs in the given order", async () => {
    await seedPack();
    const second = await seedModpack(ctx, { name: "Vitest Second" });
    const third = await seedModpack(ctx, { name: "Vitest Third" });
    await launcherPackService.addPack({
      slug: "vitest-second",
      modpackId: second.id,
      source: "sandbox",
    });
    await launcherPackService.addPack({
      slug: "vitest-third",
      modpackId: third.id,
      source: "sandbox",
    });
    const before = await owned();

    const mine = new Set(before.map((pack) => pack.id));
    const others = (await Q.launcher.pack.findAll({}, PACK_ORDER_FOR_TESTS))
      .map((pack) => pack.id)
      .filter((id) => !mine.has(id));

    await launcherPackService.reorderPacks([
      ...others,
      before[2].id,
      before[0].id,
      before[1].id,
    ]);

    expect((await owned()).map((pack) => pack.slug)).toEqual([
      "vitest-third",
      PACK_SLUG,
      "vitest-second",
    ]);
    expect((await launcherPackService.listPacks()).map((p) => p.slug)).toEqual([
      "vitest-third",
      PACK_SLUG,
      "vitest-second",
    ]);
  });

  it("refuses an order that does not name every pack exactly once", async () => {
    await seedPack();
    const [pack] = await owned();
    const all = await Q.launcher.pack.findAll({});

    await expect(
      launcherPackService.reorderPacks([pack.id, pack.id]),
    ).rejects.toThrow(/every launcher pack exactly once/);
    await expect(
      launcherPackService.reorderPacks([...all.map((p) => p.id), 999_999_999]),
    ).rejects.toThrow(/every launcher pack exactly once/);
    if (all.length > 1) {
      await expect(launcherPackService.reorderPacks([pack.id])).rejects.toThrow(
        /every launcher pack exactly once/,
      );
    }
  });

  it("removes a pack and keeps its modpack and releases", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release } = await seedReadyRelease(modpack, "1.0.0", [file]);
    const [pack] = await owned();

    const removed = await launcherPackService.removePack(pack.id);
    const latest = await refusal(launcherPackService.getLatestPack(PACK_SLUG));

    expect(removed.slug).toBe(PACK_SLUG);
    expect(await Q.launcher.pack.find({ id: pack.id })).toBeNull();
    expect(await Q.modpack.find({ id: modpack.id })).not.toBeNull();
    expect(await Q.modpack.release.find({ id: release.id })).not.toBeNull();
    expect(latest.code).toBe("PACK_NOT_FOUND");
    await expect(launcherPackService.removePack(pack.id)).rejects.toThrow(
      NotFoundError,
    );
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

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(releases.map((release) => release.version)).toEqual([
      "1.1.0",
      "1.0.0",
    ]);
    expect(releases[0]).toEqual({
      ...(await launcherPackService.getLatestPack(PACK_SLUG)),
      changelog: expect.any(Object),
    });
    expect(releases.map((release) => release.project)).toEqual([
      packProject(),
      packProject(),
    ]);
  });

  it("is empty while no release is ready", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "1.0.0", [await seedFile()]);

    expect(
      await launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE),
    ).toEqual({
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

    const first = await launcherPackService.listReleases(PACK_SLUG, {
      page: 0,
      limit: 2,
    });
    const second = await launcherPackService.listReleases(PACK_SLUG, {
      page: 1,
      limit: 2,
    });
    const pastTheEnd = await launcherPackService.listReleases(PACK_SLUG, {
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

  it("answers the one installable release of the named version on the first page", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedReadyRelease(modpack, "1.2.0", [file]);

    const listed = await launcherPackService.listReleases(PACK_SLUG, {
      ...FIRST_PAGE,
      version: "1.1.0",
    });

    expect(listed.total).toBe(1);
    expect(listed.releases.map((release) => release.version)).toEqual([
      "1.1.0",
    ]);
    expect(await listedVersions()).toEqual(["1.2.0", "1.1.0", "1.0.0"]);
  });

  it("answers no release for a version the pack never carried or can no longer install", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    const archived = await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedRelease(modpack, "1.2.0", [file]);
    archivedOnCurseForge([archived.manifest.fileId]);
    await launcherPackService.checkReleases(modpack);

    const byVersion = (version: string) =>
      launcherPackService.listReleases(PACK_SLUG, { ...FIRST_PAGE, version });

    expect(await byVersion("9.9.9")).toEqual({ releases: [], total: 0 });
    expect(await byVersion("1.1.0")).toEqual({ releases: [], total: 0 });
    expect(await byVersion("1.2.0")).toEqual({ releases: [], total: 0 });
    expect((await byVersion("1.0.0")).total).toBe(1);
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
    const listed = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(listed.total).toBe(1);
    expect(listed.releases).toEqual([
      expect.objectContaining({
        version: "1.0.0",
        minecraftVersion: "1.21.1",
        modLoader: expect.objectContaining({ id: "neoforge-21.1.249" }),
      }),
    ]);
  });

  it("diffs a full-size page in two reads and answers it from the changelog store the second time", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const fullPage = { page: 0, limit: LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE };
    for (let minor = 0; minor < fullPage.limit; minor++) {
      await seedReadyRelease(modpack, `1.${minor}.0`, [file]);
    }
    const previousReads = vi.spyOn(Q.modpack.release, "listPreceding");
    const modReads = vi.spyOn(Q.modpack.release.mod, "listForReleases");

    const first = await launcherPackService.listReleases(PACK_SLUG, fullPage);
    const readsForFirst = [
      previousReads.mock.calls.length,
      modReads.mock.calls.length,
    ];
    const second = await launcherPackService.listReleases(PACK_SLUG, fullPage);
    const readsForBoth = [
      previousReads.mock.calls.length,
      modReads.mock.calls.length,
    ];
    previousReads.mockRestore();
    modReads.mockRestore();

    expect(first.releases).toHaveLength(fullPage.limit);
    expect(readsForFirst).toEqual([1, 1]);
    expect(readsForBoth).toEqual([1, 1]);
    expect(second).toEqual(first);
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

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

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

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

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

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

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
    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.1.0",
    );
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

  it("stores the pack's project again, so what CurseForge changed reaches the launcher", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockImplementation(async (projectIds) => {
      return Q.curseforge.project.updateAll(
        {
          name: "Vitest Pack, renamed",
          thumbnailUrl: "https://media.forgecdn.net/avatars/vitest-new.png",
        },
        { id: { $in: projectIds } },
      );
    });

    await launcherPackService.checkReleases(modpack);

    expect(refreshProjects).toHaveBeenCalledWith([PACK_PROJECT_ID]);
    expect(
      (await launcherPackService.getLatestPack(PACK_SLUG)).project,
    ).toEqual({
      ...packProject(),
      name: "Vitest Pack, renamed",
      iconUrl: "https://media.forgecdn.net/avatars/vitest-new.png",
    });
  });

  it("ignores a modpack the launcher does not install", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 1,
    });

    await launcherPackService.checkReleases(modpack);

    expect(getServedFileIds).not.toHaveBeenCalled();
    expect(refreshProjects).not.toHaveBeenCalled();
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

  it("answers a stored file as stored and asks no source about it, however old it is", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    serveFromModrinth([file]);
    serveFromSandbox([file]);
    await ageStoredFile(file.fileId, 2 * HOUR_MS);
    vi.mocked(getFilesDetails).mockClear();
    vi.mocked(findModrinthFilesBySha1).mockClear();
    vi.mocked(findSandboxFileUrls).mockClear();

    const resolved = await launcherPackService.resolveFiles([file.fileId]);

    expect(resolved.files[0]).toEqual(
      expect.objectContaining({ source: "manual", url: null }),
    );
    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(findModrinthFilesBySha1).not.toHaveBeenCalled();
    expect(findCurseforgeCdnUrls).not.toHaveBeenCalled();
    expect(findSandboxFileUrls).not.toHaveBeenCalled();
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

  it("builds no address for a new file while the flag cannot be read, and leaves a stored one alone", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    const late = await seedFile({ blocked: true });
    serveFromCurseForge([file, late]);
    serveFromBuiltCdnAddress([file, late]);
    await launcherPackService.resolveFiles([file.fileId]);

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
});

describe("LauncherPackService.recheckStaleFiles", () => {
  const storedSource = async (fileId: number) =>
    (await launcherPackService.resolveFiles([fileId])).files[0];

  it("looks a manual file up again after an hour and picks up a new source", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    serveFromModrinth([file]);

    await launcherPackService.recheckStaleFiles();
    const withinTheHour = await storedSource(file.fileId);
    await ageStoredFile(file.fileId, 2 * HOUR_MS);
    const rechecked = await launcherPackService.recheckStaleFiles();
    const afterTheHour = await storedSource(file.fileId);

    expect(withinTheHour.source).toBe("manual");
    expect(rechecked).toBeGreaterThanOrEqual(1);
    expect(afterTheHour).toEqual(
      expect.objectContaining({
        source: "modrinth",
        url: modrinthUrl(file.fileId),
      }),
    );
  });

  it("looks every due file up in one run", async () => {
    const first = await seedFile({ blocked: true });
    const second = await seedFile({ blocked: true });
    serveFromCurseForge([first, second]);
    await launcherPackService.resolveFiles([first.fileId, second.fileId]);
    serveFromModrinth([first, second]);
    await ageStoredFile(first.fileId, 3 * HOUR_MS);
    await ageStoredFile(second.fileId, 2 * HOUR_MS);
    vi.mocked(getFilesDetails).mockClear();

    await launcherPackService.recheckStaleFiles();

    expect(getFilesDetails).toHaveBeenCalledTimes(1);
    expect(getFilesDetails).toHaveBeenCalledWith(
      expect.arrayContaining([first.fileId, second.fileId]),
    );
    expect((await storedSource(first.fileId)).source).toBe("modrinth");
    expect((await storedSource(second.fileId)).source).toBe("modrinth");
  });

  it("checks a built address again after a day and falls through when it stopped answering", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    serveFromBuiltCdnAddress([]);

    await ageStoredFile(file.fileId, 23 * HOUR_MS);
    await launcherPackService.recheckStaleFiles();
    const withinTheDay = await storedSource(file.fileId);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);
    await launcherPackService.recheckStaleFiles();
    const afterTheDay = await storedSource(file.fileId);

    expect(withinTheDay).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
    expect(afterTheDay).toEqual(
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

    await launcherPackService.recheckStaleFiles();

    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(2);
    expect(await storedSource(file.fileId)).toEqual(
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
    const whileOn = await storedSource(file.fileId);
    serveFromSandbox([file]);

    await useBuiltCdnAddress(false);
    await launcherPackService.recheckStaleFiles();
    const whileOff = await storedSource(file.fileId);

    expect(whileOn.source).toBe("curseforge-cdn");
    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(1);
    expect(whileOff).toEqual(
      expect.objectContaining({
        source: "storage",
        url: storageUrl(file.fileId),
      }),
    );
    expect((await Q.curseforge.file.find({ id: file.fileId }))?.source).toBe(
      "storage",
    );
  });

  it("leaves a stored built address alone while the flag cannot be read", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);

    await useBuiltCdnAddress(true);
    vi.spyOn(Q.feature.flag, "find").mockRejectedValueOnce(
      new Error("Connection terminated unexpectedly"),
    );
    await launcherPackService.recheckStaleFiles();

    expect(findCurseforgeCdnUrls).toHaveBeenCalledTimes(1);
    expect(await storedSource(file.fileId)).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("keeps serving the built address when the daily check cannot ask CurseForge", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    await expect(launcherPackService.recheckStaleFiles()).rejects.toThrow(
      "CurseForge 504",
    );

    expect(await storedSource(file.fileId)).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("keeps serving a manual file as manual when the second lookup fails, and does not retry it before it is due again", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 2 * HOUR_MS);
    vi.mocked(getFilesDetails).mockClear();
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    await expect(launcherPackService.recheckStaleFiles()).rejects.toThrow();
    await launcherPackService.recheckStaleFiles();

    expect(getFilesDetails).toHaveBeenCalledTimes(1);
    expect((await storedSource(file.fileId)).source).toBe("manual");
  });

  it("works through every due file in one run, fifty at a time", async () => {
    const files: SeededFile[] = [];
    for (let i = 0; i < 51; i++) files.push(await seedFile({ blocked: true }));
    const fileIds = files.map((file) => file.fileId);
    serveFromCurseForge(files);
    await launcherPackService.resolveFiles(fileIds);
    serveFromModrinth(files);
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date(Date.now() - 2 * HOUR_MS) },
      { id: { $in: fileIds } },
    );
    vi.mocked(getFilesDetails).mockClear();

    const rechecked = await launcherPackService.recheckStaleFiles();

    expect(rechecked).toBeGreaterThanOrEqual(51);
    expect(getFilesDetails).toHaveBeenCalledTimes(2);
    const asked = vi.mocked(getFilesDetails).mock.calls.flatMap(([ids]) => ids);
    expect(asked).toEqual(expect.arrayContaining(fileIds));
    expect(vi.mocked(getFilesDetails).mock.calls[0][0]).toHaveLength(50);
    const resolved = await launcherPackService.resolveFiles(fileIds);
    expect(resolved.files.every((file) => file.source === "modrinth")).toBe(
      true,
    );
  });

  it("puts the files of an offered release ahead of older rows no release ships", async () => {
    const modpack = await seedPack();
    const shipped = await seedFile({ blocked: true });
    const adHoc = await seedFile({ blocked: true });
    serveFromCurseForge([shipped, adHoc]);
    await launcherPackService.resolveFiles([adHoc.fileId]);
    await seedReadyRelease(modpack, "1.0.0", [shipped]);
    await ageStoredFile(adHoc.fileId, 3 * HOUR_MS);
    await ageStoredFile(shipped.fileId, 2 * HOUR_MS);

    const due = await Q.curseforge.file.getDueIds(
      { manualBefore: new Date(Date.now() - HOUR_MS), cdnBefore: null },
      100,
    );

    expect(due).toEqual(expect.arrayContaining([shipped.fileId, adHoc.fileId]));
    expect(due.indexOf(shipped.fileId)).toBeLessThan(due.indexOf(adHoc.fileId));
  });
});

describe("LauncherPackService.openStorageFile", () => {
  async function storeFromSandbox(): Promise<SeededFile> {
    const modpack = await seedPack();
    const onSandbox = await seedFile({ blocked: true });
    serveFromCurseForge([onSandbox]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      onSandbox,
    ]);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    return onSandbox;
  }

  it("opens the sandbox copy of a stored file, named and sized from the stored row", async () => {
    const file = await storeFromSandbox();
    vi.mocked(openSandboxFile).mockResolvedValue({
      body: new Blob([Buffer.from("jar bytes")]).stream(),
      size: file.detail.fileLength ?? 0,
    });
    const signal = new AbortController().signal;

    const download = await launcherPackService.openStorageFile(
      file.fileId,
      signal,
    );

    expect(openSandboxFile).toHaveBeenCalledWith(
      String(file.fileId),
      file.detail.fileLength,
      signal,
    );
    expect(download.fileName).toBe(file.detail.fileName);
    expect(download.size).toBe(file.detail.fileLength);
    expect(await new Response(download.body).text()).toBe("jar bytes");
  });

  it("refuses a file CurseForge serves itself, without asking the sandbox", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    serveFromCurseForge([served]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [served]);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    await expect(
      launcherPackService.openStorageFile(
        served.fileId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    expect(openSandboxFile).not.toHaveBeenCalled();
  });

  it("refuses a file id nothing is stored under", async () => {
    await expect(
      launcherPackService.openStorageFile(
        999_999_999,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    expect(openSandboxFile).not.toHaveBeenCalled();
  });

  it("says the file is not found when the sandbox no longer keeps it", async () => {
    const file = await storeFromSandbox();
    vi.mocked(openSandboxFile).mockResolvedValue(null);

    await expect(
      launcherPackService.openStorageFile(
        file.fileId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
  });

  it("says the file cannot be served while the sandbox fails", async () => {
    const file = await storeFromSandbox();
    vi.mocked(openSandboxFile).mockRejectedValue(
      new SandboxUnavailableError("The sandbox could not be reached"),
    );

    await expect(
      launcherPackService.openStorageFile(
        file.fileId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 502, code: "FILE_UNAVAILABLE" });
  });
});

describe("LauncherPackService.openStorageFile after the launcher went away", () => {
  it("passes the failure on as it is instead of blaming the sandbox", async () => {
    const modpack = await seedPack();
    const onSandbox = await seedFile({ blocked: true });
    serveFromCurseForge([onSandbox]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      onSandbox,
    ]);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    const gone = new AbortController();
    const failure = new SandboxUnavailableError(
      "The sandbox could not be reached: This operation was aborted",
    );
    vi.mocked(openSandboxFile).mockImplementation(async () => {
      gone.abort();
      throw failure;
    });

    await expect(
      launcherPackService.openStorageFile(onSandbox.fileId, gone.signal),
    ).rejects.toBe(failure);
  });
});
