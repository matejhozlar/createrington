import {
  expect,
  beforeAll,
  afterEach,
  beforeEach,
  afterAll,
  vi,
  type Mock,
} from "vitest";
import pool, { Q } from "@/db";
import type {
  LauncherPack,
  LauncherPackCreate,
} from "@createrington/shared/db";
import { Discord } from "@/discord/constants";
import {
  getFilesDetails,
  getServedFileIds,
  type CurseForgeFileDetail,
} from "@/services/curseforge/files";
import { resolveFileDownloads } from "@/services/curseforge/downloads";
import {
  getModpackFile,
  type ModpackFile,
  type ModpackManifest,
  type ModpackManifestSides,
} from "@/services/curseforge/modpack";
import {
  ingestProjectsWhere,
  refreshProjects,
} from "@/services/curseforge/ingest";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { launcherPackReleaseService } from "@/services/launcher/pack/pack-release.service";
import { findSandboxFileUrls } from "@/services/launcher/pack/sandbox-files";
import { getMinecraftJavaMajorVersion } from "@/services/content-gateway/minecraft";
import type {
  CurseforgeProjectCreate,
  Modpack,
  ModpackRelease,
} from "@createrington/shared/db";
import {
  cleanupLauncherPacks,
  seedLauncherPack,
} from "@/tests/helpers/launcher-pack";
import {
  cleanupWorkshopTestContext,
  createWorkshopTestContext,
  makeProjectData,
  seedModpack,
  seedProject,
} from "@/tests/helpers/workshop";

export const sendMock: Mock = vi.fn();

export const PACK_PROJECT_ID = 995_900_001;
export const PACK_SLUG = "vitest";
export const PACK_ORDER_FOR_TESTS = {
  orderBy: "position",
  orderDirection: "asc",
} as const;
export const HOUR_MS = 60 * 60 * 1000;
export const FIRST_PAGE = { page: 0, limit: 25 };
export const PACK_ON_CURSEFORGE = {
  classId: 4471,
  slug: "vitest-pack",
  name: "Vitest Pack on CurseForge",
  summary: "A synthetic test pack",
  thumbnailUrl: "https://media.forgecdn.net/avatars/vitest-pack.png",
  websiteUrl: "https://www.curseforge.com/minecraft/modpacks/vitest-pack",
  primaryAuthor: "vitest",
};

export const ctx = createWorkshopTestContext(995_000_000);
let cdnFlagBefore: boolean | null = null;

let nextFileId = 990_000_000;
let nextPackFileId = 990_500_000;

export const sha1Of = (fileId: number) => fileId.toString(16).padStart(40, "0");
export const cdnUrl = (fileId: number) =>
  `https://edge.forgecdn.net/files/${fileId}/mod-${fileId}.jar`;
export const modrinthUrl = (fileId: number) =>
  `https://cdn.modrinth.com/data/vitest/versions/${fileId}/mod-${fileId}.jar`;
export const builtCdnUrl = (fileId: number) =>
  `https://mediafilez.forgecdn.net/files/vitest/${fileId}/mod-${fileId}.jar`;
const sandboxUrl = (fileId: number) =>
  `https://sandbox.createrington.test/api/pack/files/${fileId}`;
export const storageUrl = (fileId: number) =>
  expect.stringMatching(new RegExp(`/api/launcher/packs/files/${fileId}$`));
export const storageSnapshotUrl = (snapshotId: number) =>
  expect.stringMatching(
    new RegExp(`/api/launcher/packs/files/snapshot/${snapshotId}$`),
  );

export interface SeededFile {
  fileId: number;
  projectId: number;
  sides: ModpackManifestSides;
  required: boolean;
  detail: CurseForgeFileDetail;
}

export async function seedFile(
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

export function serveFromCurseForge(files: SeededFile[]): void {
  const byId = new Map(files.map((file) => [file.fileId, file.detail]));
  vi.mocked(getFilesDetails).mockImplementation(async (fileIds) =>
    fileIds.flatMap((id) => byId.get(id) ?? []),
  );
}

const hostedOnModrinth = new Set<number>();
const answeringOnCdn = new Set<number>();

function resolveThroughGateway(): void {
  hostedOnModrinth.clear();
  answeringOnCdn.clear();
  vi.mocked(resolveFileDownloads).mockImplementation(
    async (fileIds, options) =>
      new Map(
        fileIds.map((fileId) => [
          fileId,
          hostedOnModrinth.has(fileId)
            ? { source: "modrinth", url: modrinthUrl(fileId), retry: false }
            : options.cdn && answeringOnCdn.has(fileId)
              ? {
                  source: "curseforge-cdn",
                  url: builtCdnUrl(fileId),
                  retry: false,
                }
              : { source: null, url: null, retry: false },
        ]),
      ),
  );
}

export function serveFromModrinth(files: SeededFile[]): void {
  hostedOnModrinth.clear();
  for (const file of files) hostedOnModrinth.add(file.fileId);
}

export function serveFromBuiltCdnAddress(files: SeededFile[]): void {
  answeringOnCdn.clear();
  for (const file of files) answeringOnCdn.add(file.fileId);
}

export function sourcesCannotBeAsked(): void {
  vi.mocked(resolveFileDownloads).mockImplementation(
    async (fileIds) =>
      new Map(
        fileIds.map((fileId) => [
          fileId,
          { source: null, url: null, retry: true },
        ]),
      ),
  );
}

export function serveFromSandbox(files: SeededFile[]): void {
  vi.mocked(findSandboxFileUrls).mockResolvedValue(
    new Map(files.map((file) => [file.fileId, sandboxUrl(file.fileId)])),
  );
}

export const useBuiltCdnAddress = (enabled: boolean) =>
  featureFlagService.setEnabled(FeatureFlags.launcherCurseforgeCdn, enabled);

export const ageStoredFile = (fileId: number, ageMs: number) =>
  Q.curseforge.file.updateAll(
    { resolvedAt: new Date(Date.now() - ageMs) },
    { id: fileId },
  );

export function ingestFromCurseForge(
  classByProject: Map<number, number>,
): void {
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

export function packZip(fileId: number, overrides: Partial<ModpackFile> = {}) {
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

export async function seedRelease(
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

export async function seedReadyRelease(
  modpack: Modpack,
  version: string,
  files: SeededFile[],
): Promise<{ release: ModpackRelease; manifest: ModpackManifest }> {
  const seeded = await seedRelease(modpack, version, files);
  await launcherPackReleaseService.prepareRelease(
    modpack,
    seeded.release.id,
    seeded.manifest,
  );
  return seeded;
}

export function archivedOnCurseForge(fileIds: number[]): void {
  const archived = new Set(fileIds);
  vi.mocked(getServedFileIds).mockImplementation(
    async (asked) => new Set(asked.filter((id) => !archived.has(id))),
  );
}

export const listedVersions = async () =>
  (await launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE)).releases.map(
    (release) => release.version,
  );

export const packProject = (projectId = PACK_PROJECT_ID) => ({
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

export async function seedPackProject(
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

export async function offerToLauncher(
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

export async function seedPack(
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

export async function seedPackWithoutProject(
  projectId: number,
): Promise<Modpack> {
  const modpack = await seedModpack(ctx, {
    name: "Vitest Pack",
    curseforgeProjectId: projectId,
  });
  await offerToLauncher(modpack);
  return modpack;
}

export async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; statusCode?: number };
  }
  throw new Error("Expected the call to be refused");
}

export const isReady = async (releaseId: number) =>
  (await Q.modpack.release.get({ id: releaseId })).launcherReadyAt !== null;

export function useLauncherPackTestHooks(): void {
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
    resolveThroughGateway();
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
}
