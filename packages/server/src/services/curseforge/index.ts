import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import JSZip from "jszip";
import { z } from "zod";
import {
  CURSEFORGE_MINECRAFT_GAME_ID,
  CurseForgeHashAlgo,
  CurseForgeModLoaderType,
  CurseForgeRelationType,
  CurseForgeSortField as CurseForgeSortFields,
  curseforgeCategorySchema,
  curseforgeData,
  curseforgeFileIndexSchema,
  curseforgeFileSchema,
  curseforgeFingerprintMatchesSchema,
  curseforgeList,
  curseforgeLogoSchema,
  curseforgeMinecraftVersionSchema,
  curseforgeModSchema,
  curseforgePage,
  type CurseForgeAnswer,
  type CurseForgeRequest,
  type FileSource,
} from "@createrington/content-gateway-client";
import config from "@/config";
import { contentGateway, currentContentPool } from "@/services/content-gateway";
import {
  createKeyValueStore,
  readStored,
  writeStored,
} from "@/services/key-value-store";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

export const CurseForgeClass = CURSEFORGE_CLASSES;

export const CurseForgeLoader = {
  forge: CurseForgeModLoaderType.forge,
  fabric: CurseForgeModLoaderType.fabric,
  quilt: CurseForgeModLoaderType.quilt,
  neoforge: CurseForgeModLoaderType.neoForge,
} as const;

export const CurseForgeSortField = {
  popularity: CurseForgeSortFields.popularity,
  lastUpdated: CurseForgeSortFields.lastUpdated,
  totalDownloads: CurseForgeSortFields.totalDownloads,
  releasedDate: CurseForgeSortFields.releasedDate,
} as const;

const CF_DOWNLOAD_TIMEOUT_MS = 120_000;

function parseCfResponse<T extends z.ZodType>(
  schema: T,
  body: unknown,
  endpoint: string,
): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    logger.warn(
      `CurseForge ${endpoint} response shape mismatch: ${parsed.error.message}`,
    );
    throw new Error(`CurseForge ${endpoint} returned an unexpected response`);
  }
  return parsed.data;
}

const searchHitSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  summary: z.string().nullish(),
  authors: z.array(z.looseObject({ name: z.string() })).nullish(),
  downloadCount: z.number().nullish(),
  links: z.looseObject({ websiteUrl: z.string() }),
  logo: curseforgeLogoSchema.nullish(),
});

const modFileSchema = curseforgeFileSchema.extend({
  displayName: z.string(),
  fileName: z.string(),
  fileDate: z.string(),
  fileLength: z.number(),
  releaseType: z.number(),
  gameVersions: z.array(z.string()),
});

const dependencyModSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  links: z.looseObject({ websiteUrl: z.string() }),
  logo: curseforgeLogoSchema.nullish(),
  latestFilesIndexes: z.array(curseforgeFileIndexSchema).nullish(),
});

type RawLogo = z.infer<typeof curseforgeLogoSchema> | null | undefined;
type RawHashes = z.infer<typeof curseforgeFileSchema>["hashes"];

function logoUrlOf(logo: RawLogo): string | null {
  return logo?.thumbnailUrl || logo?.url || null;
}

function sha1Of(hashes: RawHashes): string | null {
  const sha1 = hashes?.find(
    (hash) => hash.algo === CurseForgeHashAlgo.sha1,
  )?.value;
  return sha1 ? sha1.toLowerCase() : null;
}

function isDependency(dependency: { relationType: number }): boolean {
  return (
    dependency.relationType === CurseForgeRelationType.optionalDependency ||
    dependency.relationType === CurseForgeRelationType.requiredDependency
  );
}

const MINECRAFT_GAME_ID = CURSEFORGE_MINECRAFT_GAME_ID;
const MOD_CLASS_ID: number = CurseForgeClass.mods;
const NEOFORGE_LOADER_TYPE: number = CurseForgeLoader.neoforge;
const DEFAULT_GAME_VERSION: string = config.curseforge.defaultGameVersion;
const MODPACK_PROJECT_ID: number = config.curseforge.modpackProjectId;
const MODPACK_CACHE_TTL = config.curseforge.modpackCacheTtlMs;
const MODPACK_INCOMPLETE_CACHE_TTL =
  config.curseforge.modpackIncompleteCacheTtlMs;

/**
 * Sends one request to the CurseForge API through the content gateway, which
 * holds the key, counts the call against the pool the caller is in and
 * answers from its cache while it can, and returns what CurseForge answered.
 * The gateway's own refusals (the budget of the minute spent, CurseForge
 * holding the key off after a 429, a timeout upstream) throw as
 * `ContentGatewayError`. File downloads from the CDN are not calls to the API
 * and do not come through here.
 */
async function cfFetch(
  path: string,
  request: CurseForgeRequest = {},
): Promise<CurseForgeAnswer> {
  return contentGateway().curseforge(path, {
    pool: currentContentPool(),
    ...request,
  });
}

function answerText(answer: CurseForgeAnswer): string {
  if (answer.body === null) return "";
  return typeof answer.body === "string"
    ? answer.body
    : JSON.stringify(answer.body);
}

const ID_ENDPOINTS = {
  mods: { path: "mods", idsKey: "modIds" },
  files: { path: "mods/files", idsKey: "fileIds" },
} as const;

/**
 * Posts ids to one of the batch endpoints and returns every row CurseForge
 * answers; the gateway splits the ids CurseForge has to be asked about into
 * calls of 100. CurseForge answers a request of which it knows no id with a
 * 404 and no body, not with an empty list, so that counts as no rows; any
 * other failure throws `<failure> (<status>)`.
 */
async function postIds<T extends z.ZodType>(request: {
  of: keyof typeof ID_ENDPOINTS;
  ids: number[];
  row: T;
  endpoint: string;
  failure: string;
}): Promise<z.infer<T>[]> {
  if (request.ids.length === 0) return [];
  const { path, idsKey } = ID_ENDPOINTS[request.of];

  const answer = await cfFetch(path, { body: { [idsKey]: request.ids } });
  if (answer.status === 404) return [];
  if (!answer.ok) {
    throw new Error(
      `${request.failure} (${answer.status}): ${answerText(answer)}`,
    );
  }
  return parseCfResponse(
    curseforgeList(request.row),
    answer.body,
    request.endpoint,
  ).data;
}

export interface CurseForgeTarget {
  gameVersion?: string;
  modLoaderType?: number;
}

export interface CurseForgeSearchOptions {
  gameVersion?: string;
  /** null omits the loader filter, for classes whose files carry no loader tags */
  modLoaderType?: number | null;
  classId?: number;
  /** Modpack used for the inModpack annotation; null skips the check entirely */
  packProjectId?: number | null;
}

export interface CurseForgeSearchResult {
  id: number;
  name: string;
  slug: string;
  url: string;
  thumbnailUrl?: string;
  summary: string | null;
  primaryAuthor: string | null;
  downloadCount: number;
  inModpack: boolean;
}

export interface CurseForgeModFile {
  id: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  fileDate: string;
  fileLength: number;
  releaseType: number;
  gameVersions: string[];
  hashes: Array<{ value: string; algo: number }>;
  dependencies: Array<{ modId: number; relationType: number }>;
}

export type CurseForgeEnvironmentHint = "client" | "server" | "both";

export interface CurseForgeProjectData {
  id: number;
  classId: number;
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string;
  wikiUrl: string | null;
  issuesUrl: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  authors: Array<{
    id: number;
    name: string;
    url: string;
    avatarUrl?: string | null;
  }>;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
    iconUrl?: string;
  }>;
  screenshots: Array<{ title: string; thumbnailUrl: string; url: string }>;
  downloadCount: number;
  isAvailable: boolean;
  allowModDistribution: boolean | null;
  dateCreated: string | null;
  dateModified: string;
  dateReleased: string;
  latestFilesIndexes: Array<{
    gameVersion: string;
    fileId: number;
    filename: string;
    releaseType: number;
    modLoader: number | null;
  }>;
  environmentHint: CurseForgeEnvironmentHint | null;
}

export interface ResolvedDependency {
  modId: number;
  modName: string;
  modUrl?: string;
  thumbnailUrl?: string;
  inPack: boolean;
  bestFile: { id: number; fileName: string } | null;
}

/**
 * Search CurseForge projects by name, filtered by class, loader, and game version
 *
 * Defaults target the current server setup (NeoForge mods for the default game
 * version). Results are annotated with whether they are already in the modpack.
 */
export async function searchMods(
  query: string,
  pageSize = 50,
  options: CurseForgeSearchOptions = {},
): Promise<CurseForgeSearchResult[]> {
  const {
    gameVersion = DEFAULT_GAME_VERSION,
    modLoaderType = NEOFORGE_LOADER_TYPE,
    classId = MOD_CLASS_ID,
    packProjectId = MODPACK_PROJECT_ID,
  } = options;

  const answer = await cfFetch("mods/search", {
    query: {
      gameId: MINECRAFT_GAME_ID,
      searchFilter: query,
      pageSize,
      sortField: CurseForgeSortField.popularity,
      sortOrder: "desc",
      classId,
      modLoaderType,
      gameVersion,
    },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge search failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeList(searchHitSchema),
    answer.body,
    "search",
  );

  let modpackModIds: Set<number>;
  try {
    modpackModIds =
      packProjectId === null
        ? new Set<number>()
        : await getModpackModIds(packProjectId);
  } catch (error) {
    logger.warn(
      `Modpack manifest fetch failed for pack ${packProjectId}, search results will report inModpack: false`,
      error,
    );
    modpackModIds = new Set();
  }

  return body.data.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    url: m.links.websiteUrl,
    thumbnailUrl: logoUrlOf(m.logo) ?? undefined,
    summary: m.summary ?? null,
    primaryAuthor: m.authors?.[0]?.name ?? null,
    downloadCount: m.downloadCount ?? 0,
    inModpack: modpackModIds.has(m.id),
  }));
}

/**
 * Look up a single project by its URL slug (exact match within a class).
 * Returns null when nothing matches or the slug is ambiguous within the class.
 */
export async function findModBySlug(
  slug: string,
  classId: number = MOD_CLASS_ID,
): Promise<{ id: number; name: string } | null> {
  const answer = await cfFetch("mods/search", {
    query: { gameId: MINECRAFT_GAME_ID, classId, slug },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge slug lookup failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeList(z.looseObject({ id: z.number(), name: z.string() })),
    answer.body,
    "slug lookup",
  );

  if (body.data.length > 1) {
    logger.warn(
      `CurseForge slug lookup for "${slug}" (class ${classId}) returned ${body.data.length} projects, treating as not found`,
    );
    return null;
  }

  const found = body.data[0];
  return found ? { id: found.id, name: found.name } : null;
}

/**
 * Fetch the available files for a mod, filtered by game version and mod loader
 *
 * Only optional (relationType 2) and required (relationType 3) dependencies are included.
 */
export async function getModFiles(
  modId: number,
  gameVersion = DEFAULT_GAME_VERSION,
  modLoaderType = NEOFORGE_LOADER_TYPE,
): Promise<CurseForgeModFile[]> {
  const answer = await cfFetch(`mods/${modId}/files`, {
    query: { gameVersion, modLoaderType },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge getModFiles failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeList(modFileSchema),
    answer.body,
    "getModFiles",
  );

  return body.data.map((f) => ({
    id: f.id,
    displayName: f.displayName,
    fileName: f.fileName,
    downloadUrl: f.downloadUrl ?? null,
    fileDate: f.fileDate,
    fileLength: f.fileLength,
    releaseType: f.releaseType,
    gameVersions: f.gameVersions,
    hashes: (f.hashes ?? []).map((hash) => ({
      value: hash.value,
      algo: hash.algo,
    })),
    dependencies: (f.dependencies ?? [])
      .filter(isDependency)
      .map((d) => ({ modId: d.modId, relationType: d.relationType })),
  }));
}

type RawCurseForgeMod = z.infer<typeof curseforgeModSchema>;

// CurseForge surfaces the author-assigned environment checkboxes as plain
// "Client" / "Server" entries mixed into each file's gameVersions array
export function deriveEnvironmentHint(
  files: Array<{ gameVersions?: string[] | null }>,
): CurseForgeEnvironmentHint | null {
  let client = false;
  let server = false;
  for (const file of files) {
    for (const tag of file.gameVersions ?? []) {
      if (tag === "Client") client = true;
      else if (tag === "Server") server = true;
    }
  }
  if (client && server) return "both";
  if (client) return "client";
  if (server) return "server";
  return null;
}

const CLIENT_ONLY_CLASSES: ReadonlySet<number> = new Set([
  CurseForgeClass.shaders,
  CurseForgeClass.resourcePacks,
]);

/** Classes whose files carry no loader tags, so a loader-filtered search returns nothing */
export const LOADERLESS_CLASSES: ReadonlySet<number> = new Set([
  CurseForgeClass.shaders,
  CurseForgeClass.resourcePacks,
]);

export function classEnvironmentHint(
  classId: number,
): CurseForgeEnvironmentHint | null {
  return CLIENT_ONLY_CLASSES.has(classId) ? "client" : null;
}

function mapProject(raw: RawCurseForgeMod): CurseForgeProjectData {
  return {
    id: raw.id,
    classId: raw.classId,
    slug: raw.slug,
    name: raw.name,
    summary: raw.summary,
    websiteUrl: raw.links.websiteUrl,
    wikiUrl: raw.links.wikiUrl || null,
    issuesUrl: raw.links.issuesUrl || null,
    sourceUrl: raw.links.sourceUrl || null,
    thumbnailUrl: logoUrlOf(raw.logo),
    authors: raw.authors.map((author) => ({
      id: author.id,
      name: author.name,
      url: author.url,
      avatarUrl: author.avatarUrl,
    })),
    categories: raw.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      iconUrl: category.iconUrl ?? undefined,
    })),
    screenshots: (raw.screenshots ?? []).map((screenshot) => ({
      title: screenshot.title,
      thumbnailUrl: screenshot.thumbnailUrl,
      url: screenshot.url,
    })),
    downloadCount: raw.downloadCount,
    isAvailable: raw.isAvailable,
    allowModDistribution: raw.allowModDistribution ?? null,
    dateCreated: raw.dateCreated ?? null,
    dateModified: raw.dateModified,
    dateReleased: raw.dateReleased,
    latestFilesIndexes: (raw.latestFilesIndexes ?? []).map((idx) => ({
      gameVersion: idx.gameVersion,
      fileId: idx.fileId,
      filename: idx.filename,
      releaseType: idx.releaseType,
      modLoader: idx.modLoader ?? null,
    })),
    environmentHint: deriveEnvironmentHint(raw.latestFiles ?? []),
  };
}

/**
 * Fetch full metadata for a single CurseForge project, including authors,
 * categories, screenshots, and file indexes
 */
export async function getMod(
  projectId: number,
): Promise<CurseForgeProjectData> {
  const answer = await cfFetch(`mods/${projectId}`);
  if (!answer.ok) {
    throw new Error(
      `CurseForge getMod failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeData(curseforgeModSchema),
    answer.body,
    "getMod",
  );
  return mapProject(body.data);
}

/**
 * Fetch full metadata for multiple CurseForge projects in one request,
 * returning data for every ID the API resolved
 */
export async function getMods(
  projectIds: number[],
): Promise<CurseForgeProjectData[]> {
  const mods = await postIds({
    of: "mods",
    ids: projectIds,
    row: curseforgeModSchema,
    endpoint: "getMods",
    failure: "CurseForge getMods failed",
  });
  return mods.map(mapProject);
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map((part) => parseInt(part, 10));
  const pb = b.split(".").map((part) => parseInt(part, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Fetch all released Minecraft versions, newest first (the gateway keeps the list for a day) */
export async function getMinecraftVersions(): Promise<string[]> {
  const answer = await cfFetch("minecraft/version");
  if (!answer.ok) {
    throw new Error(
      `CurseForge getMinecraftVersions failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeList(curseforgeMinecraftVersionSchema),
    answer.body,
    "getMinecraftVersions",
  );
  return body.data
    .map((entry) => entry.versionString)
    .sort(compareVersionsDesc);
}

/** Fetch the direct download URL for a specific mod file */
export async function getModFileDownloadUrl(
  modId: number,
  fileId: number,
): Promise<string> {
  const answer = await cfFetch(`mods/${modId}/files/${fileId}/download-url`);
  if (!answer.ok) {
    throw new Error(
      `CurseForge getDownloadUrl failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  return parseCfResponse(
    curseforgeData(z.string()),
    answer.body,
    "getDownloadUrl",
  ).data;
}

/**
 * Resolve a list of dependency mod IDs to their display info and best
 * compatible file in one request
 *
 * Checks whether each dependency is already present in the given pack mod set.
 * Best file selection prefers the target loader + game version, falling back to
 * game version alone when no loader-specific file is available.
 */
export async function resolveDependencies(
  modIds: number[],
  packModIds: Set<number>,
  target: CurseForgeTarget = {},
): Promise<ResolvedDependency[]> {
  if (modIds.length === 0) return [];

  const {
    gameVersion = DEFAULT_GAME_VERSION,
    modLoaderType = NEOFORGE_LOADER_TYPE,
  } = target;

  const mods = await postIds({
    of: "mods",
    ids: modIds,
    row: dependencyModSchema,
    endpoint: "resolveDependencies",
    failure: "Failed to resolve dependencies",
  });

  return mods.map((mod) => {
    const indexes = mod.latestFilesIndexes ?? [];
    let bestIndex = indexes.find(
      (idx) =>
        idx.gameVersion === gameVersion && idx.modLoader === modLoaderType,
    );
    if (!bestIndex) {
      bestIndex = indexes.find((idx) => idx.gameVersion === gameVersion);
    }

    return {
      modId: mod.id,
      modName: mod.name,
      modUrl: mod.links.websiteUrl,
      thumbnailUrl: logoUrlOf(mod.logo) ?? undefined,
      inPack: packModIds.has(mod.id),
      bestFile: bestIndex
        ? { id: bestIndex.fileId, fileName: bestIndex.filename }
        : null,
    };
  });
}

export interface CurseForgeFileDetail {
  fileId: number;
  projectId: number;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  releaseType: number | null;
  gameId: number | null;
  /** Null when the author opted out of third-party distribution. */
  downloadUrl: string | null;
  fileLength: number | null;
  sha1: string | null;
}

type RawFile = z.infer<typeof curseforgeFileSchema>;

async function fetchFiles(fileIds: number[]): Promise<RawFile[]> {
  return postIds({
    of: "files",
    ids: fileIds,
    row: curseforgeFileSchema,
    endpoint: "getFilesDetails",
    failure: "Failed to fetch file details",
  });
}

/** Identity and download facts of specific mod files, in one request. Unknown ids are simply absent. */
export async function getFilesDetails(
  fileIds: number[],
): Promise<CurseForgeFileDetail[]> {
  return (await fetchFiles(fileIds)).map((f) => ({
    fileId: f.id,
    projectId: f.modId,
    displayName: f.displayName ?? null,
    fileName: f.fileName ?? null,
    fileDate: f.fileDate ?? null,
    releaseType: f.releaseType ?? null,
    gameId: f.gameId ?? null,
    downloadUrl: f.downloadUrl || null,
    fileLength: f.fileLength ?? null,
    sha1: sha1Of(f.hashes),
  }));
}

/**
 * Of the given file ids (mod files or pack files), the ones CurseForge still
 * serves, in one request. An archived file stays known to the API and keeps
 * its download link, it only reads as not available, so that flag decides; an
 * id CurseForge does not know is left out as well.
 */
export async function getServedFileIds(
  fileIds: number[],
): Promise<Set<number>> {
  return new Set(
    (await fetchFiles(fileIds))
      .filter((f) => f.isAvailable !== false)
      .map((f) => f.id),
  );
}

/**
 * Fetch per-file dependency info for multiple mod files in one request
 *
 * Only optional (relationType 2) and required (relationType 3) dependencies are returned.
 */
export async function getFilesDependencies(fileIds: number[]): Promise<
  Array<{
    fileId: number;
    modId: number;
    dependencies: Array<{ modId: number; relationType: number }>;
  }>
> {
  const files = await postIds({
    of: "files",
    ids: fileIds,
    row: curseforgeFileSchema,
    endpoint: "getFilesDependencies",
    failure: "Failed to fetch file dependencies",
  });
  return files.map((f) => ({
    fileId: f.id,
    modId: f.modId,
    dependencies: (f.dependencies ?? [])
      .filter(isDependency)
      .map((d) => ({ modId: d.modId, relationType: d.relationType })),
  }));
}

export interface CurseForgePage {
  /** Zero-based offset of the first result; CurseForge refuses `index + pageSize` above 10,000. */
  index: number;
  pageSize: number;
}

export interface CurseForgeProjectHit {
  id: number;
  classId: number;
  slug: string;
  name: string;
  summary: string | null;
  websiteUrl: string;
  thumbnailUrl: string | null;
  primaryAuthor: string | null;
  downloadCount: number;
}

export interface CurseForgeContentFile {
  id: number;
  projectId: number;
  gameId: number | null;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  releaseType: number | null;
  /** Null when the author opted out of third-party distribution. */
  downloadUrl: string | null;
  fileLength: number | null;
  sha1: string | null;
  gameVersions: string[];
  dependencies: Array<{ projectId: number; required: boolean }>;
}

function toContentFile(raw: RawFile): CurseForgeContentFile {
  return {
    id: raw.id,
    projectId: raw.modId,
    gameId: raw.gameId ?? null,
    displayName: raw.displayName ?? null,
    fileName: raw.fileName ?? null,
    fileDate: raw.fileDate ?? null,
    releaseType: raw.releaseType ?? null,
    downloadUrl: raw.downloadUrl || null,
    fileLength: raw.fileLength ?? null,
    sha1: sha1Of(raw.hashes),
    gameVersions: raw.gameVersions ?? [],
    dependencies: (raw.dependencies ?? [])
      .filter(isDependency)
      .map((dependency) => ({
        projectId: dependency.modId,
        required:
          dependency.relationType === CurseForgeRelationType.requiredDependency,
      })),
  };
}

/**
 * One page of the Minecraft projects of a class that match the text, with the
 * number of matches CurseForge counts in total: most popular first, or highest
 * first by `sortField`. An empty text lists the class, and `categoryIds`
 * narrows it to those categories. Unlike `searchMods` it targets no default
 * game version or loader and does not look at the modpack.
 */
export async function searchProjects(
  options: {
    query: string;
    classId: number;
    gameVersion?: string;
    modLoaderType?: number | null;
    categoryIds?: number[];
    sortField?: number;
  } & CurseForgePage,
): Promise<{ projects: CurseForgeProjectHit[]; total: number }> {
  const answer = await cfFetch("mods/search", {
    query: {
      gameId: MINECRAFT_GAME_ID,
      classId: options.classId,
      sortField: options.sortField ?? CurseForgeSortField.popularity,
      sortOrder: "desc",
      index: options.index,
      pageSize: options.pageSize,
      searchFilter: options.query || undefined,
      categoryIds: options.categoryIds?.length
        ? JSON.stringify(options.categoryIds)
        : undefined,
      gameVersion: options.gameVersion || undefined,
      modLoaderType: options.modLoaderType,
    },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge search failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgePage(searchHitSchema),
    answer.body,
    "search",
  );

  return {
    projects: body.data.map((project) => ({
      id: project.id,
      classId: options.classId,
      slug: project.slug,
      name: project.name,
      summary: project.summary || null,
      websiteUrl: project.links.websiteUrl,
      thumbnailUrl: logoUrlOf(project.logo),
      primaryAuthor: project.authors?.[0]?.name ?? null,
      downloadCount: project.downloadCount ?? 0,
    })),
    total: body.pagination.totalCount,
  };
}

export interface CurseForgeCategory {
  id: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  parentCategoryId: number | null;
}

/**
 * The categories of a Minecraft class in the order CurseForge lists them,
 * nested ones included, each with the category it sits under.
 */
export async function listCategories(
  classId: number,
): Promise<CurseForgeCategory[]> {
  const answer = await cfFetch("categories", {
    query: { gameId: MINECRAFT_GAME_ID, classId },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge categories failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeList(curseforgeCategorySchema),
    answer.body,
    "categories",
  );

  return body.data
    .filter((category) => !category.isClass)
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      iconUrl: category.iconUrl || null,
      parentCategoryId: category.parentCategoryId ?? null,
    }));
}

/**
 * One page of a project's files in the order CurseForge lists them, with the
 * number of files that match in total. Unlike `getModFiles` it targets no
 * default game version or loader.
 */
export async function listProjectFiles(
  projectId: number,
  options: {
    gameVersion?: string;
    modLoaderType?: number | null;
  } & CurseForgePage,
): Promise<{ files: CurseForgeContentFile[]; total: number }> {
  const answer = await cfFetch(`mods/${projectId}/files`, {
    query: {
      index: options.index,
      pageSize: options.pageSize,
      gameVersion: options.gameVersion || undefined,
      modLoaderType: options.modLoaderType,
    },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge listProjectFiles failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgePage(curseforgeFileSchema),
    answer.body,
    "listProjectFiles",
  );

  return {
    files: body.data.map(toContentFile),
    total: body.pagination.totalCount,
  };
}

/** Files by id with their game versions and dependencies, in one request. Unknown ids are simply absent. */
export async function getContentFiles(
  fileIds: number[],
): Promise<CurseForgeContentFile[]> {
  const files = await postIds({
    of: "files",
    ids: fileIds,
    row: curseforgeFileSchema,
    endpoint: "getContentFiles",
    failure: "CurseForge getContentFiles failed",
  });
  return files.map(toContentFile);
}

/**
 * Reads an endpoint that answers one piece of HTML, an empty text when
 * CurseForge holds none there. Null when CurseForge answers 404.
 */
async function getHtml(path: string, endpoint: string): Promise<string | null> {
  const answer = await cfFetch(path);
  if (answer.status === 404) return null;
  if (!answer.ok) {
    throw new Error(
      `CurseForge ${endpoint} failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeData(z.string().nullish()),
    answer.body,
    endpoint,
  );
  return body.data ?? "";
}

/**
 * The long description of a project as CurseForge holds it, in HTML: an empty
 * text when it holds none. Null when CurseForge does not know the project.
 */
export async function getProjectDescription(
  projectId: number,
): Promise<string | null> {
  return getHtml(`mods/${projectId}/description`, "getProjectDescription");
}

/**
 * What changed in a file as CurseForge holds it, in HTML: an empty text when
 * the file has no changelog. Null when CurseForge knows no such file of that
 * project.
 */
export async function getFileChangelog(
  projectId: number,
  fileId: number,
): Promise<string | null> {
  return getHtml(
    `mods/${projectId}/files/${fileId}/changelog`,
    "getFileChangelog",
  );
}

export interface CurseForgeFingerprintMatch {
  fingerprint: number;
  file: CurseForgeContentFile;
}

/**
 * The Minecraft files whose CurseForge fingerprint (murmur2 with seed 1 over
 * the file's bytes without whitespace) is one of these, asked in one request.
 * A fingerprint CurseForge does not know is simply absent, and one that
 * several files share comes back once per file, in CurseForge's order.
 */
export async function matchFingerprints(
  fingerprints: number[],
): Promise<CurseForgeFingerprintMatch[]> {
  const answer = await cfFetch(`fingerprints/${MINECRAFT_GAME_ID}`, {
    body: { fingerprints },
  });
  if (!answer.ok) {
    throw new Error(
      `CurseForge matchFingerprints failed (${answer.status}): ${answerText(answer)}`,
    );
  }

  const body = parseCfResponse(
    curseforgeData(curseforgeFingerprintMatchesSchema),
    answer.body,
    "matchFingerprints",
  );

  return (body.data.exactMatches ?? []).map(({ file }) => ({
    fingerprint: file.fileFingerprint,
    file: toContentFile(file),
  }));
}

/** Where a file can be downloaded from, as the gateway resolved it. */
export interface CurseForgeFileDownload {
  /** CurseForge's own link, Modrinth's copy, the built CDN address, or null when no source has the file. */
  source: FileSource | null;
  url: string | null;
  /** True when a source could not be asked this time, so a null `source` is worth asking again rather than remembering. */
  retry: boolean;
}

/**
 * A download address per CurseForge file id, from the gateway's resolve:
 * CurseForge's own link, else Modrinth's copy of the file found by SHA-1,
 * else, when `cdn` is on, the file's built address on CurseForge's CDN when
 * it answers there with the file's size. A file CurseForge does not know
 * comes back with no source. Throws when the gateway refuses the call or
 * CurseForge cannot be asked.
 */
export async function resolveFileDownloads(
  fileIds: number[],
  options: { cdn: boolean; timeoutMs?: number },
): Promise<Map<number, CurseForgeFileDownload>> {
  if (fileIds.length === 0) return new Map();
  const { files } = await contentGateway().resolve(fileIds, {
    cdn: options.cdn,
    pool: currentContentPool(),
    timeoutMs: options.timeoutMs,
  });
  return new Map(
    files.map((file) => [
      file.fileId,
      {
        source: file.source ?? null,
        url: file.url ?? null,
        retry: file.retry,
      },
    ]),
  );
}

/** Which of a release's manifests listed an entry. */
export type ModpackManifestSides = "client" | "server" | "both";

export interface ModpackManifestEntry {
  projectId: number;
  fileId: number;
  required: boolean;
  sides: ModpackManifestSides;
}

export interface ModpackManifest {
  /** The client pack file; identity of the release. */
  fileId: number;
  /** The server pack read alongside the client file, null when the release ships none. */
  serverPackFileId: number | null;
  displayName: string | null;
  version: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  publishedAt: string | null;
  entries: ModpackManifestEntry[];
  modIds: Set<number>;
  /** Projects the manifest ships only as not-required entries, i.e. disabled in the pack. */
  disabledModIds: Set<number>;
}

/**
 * Projects whose every manifest entry carries required: false, which is how
 * the CurseForge app exports mods disabled in a profile
 */
export function manifestDisabledModIds(
  files: Array<{ projectId: number; required: boolean }>,
): Set<number> {
  const requiredByProject = new Map<number, boolean>();
  for (const file of files) {
    requiredByProject.set(
      file.projectId,
      (requiredByProject.get(file.projectId) ?? false) || file.required,
    );
  }
  return new Set(
    [...requiredByProject].flatMap(([projectId, required]) =>
      required ? [] : [projectId],
    ),
  );
}

/**
 * Union of a release's client and server manifests, client entries first.
 * A project the server manifest repeats is not listed again; it marks the
 * client entry as shipping to both sides, and the client entry's file and
 * required flag win (the sandbox writes both manifests from one plan, so
 * they agree). Without a server pack every entry is client-side by
 * definition
 */
export function mergeManifestFiles<T extends { projectId: number }>(
  client: T[],
  server: T[] | null,
): Array<T & { sides: ModpackManifestSides }> {
  if (server === null) {
    return client.map((file) => ({ ...file, sides: "client" as const }));
  }
  const clientProjects = new Set(client.map((file) => file.projectId));
  const serverProjects = new Set(server.map((file) => file.projectId));
  return [
    ...client.map((file) => ({
      ...file,
      sides: serverProjects.has(file.projectId)
        ? ("both" as const)
        : ("client" as const),
    })),
    ...server
      .filter((file) => !clientProjects.has(file.projectId))
      .map((file) => ({ ...file, sides: "server" as const })),
  ];
}

/** One file of a modpack project as CurseForge describes it, server packs and additional files included. */
export interface ModpackFile {
  id: number;
  projectId: number;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  downloadUrl: string | null;
  fileLength: number | null;
  sha1: string | null;
  fileStatus: number | null;
  isAvailable: boolean;
  serverPackFileId: number | null;
  alternateFileId: number | null;
  parentProjectFileId: number | null;
  isServerPack: boolean;
}

/** A release the sandbox reported after publishing it: the client file and the server pack it uploaded. */
export interface ModpackPublishHint {
  clientFileId: number;
  serverPackFileId: number | null;
}

/** What the database knows about a pack that shapes how its newest release is read. */
export interface ModpackReadContext {
  shipsServerPack: boolean;
  publishes: ModpackPublishHint[];
}

export interface ModpackReleaseResolution {
  file: ModpackFile;
  serverPackFileId: number | null;
  /** False when the pack ships a server pack and this read found none. */
  complete: boolean;
}

function toModpackFile(raw: RawFile): ModpackFile {
  return {
    id: raw.id,
    projectId: raw.modId,
    displayName: raw.displayName ?? null,
    fileName: raw.fileName ?? null,
    fileDate: raw.fileDate ?? null,
    downloadUrl: raw.downloadUrl || null,
    fileLength: raw.fileLength ?? null,
    sha1: sha1Of(raw.hashes),
    fileStatus: raw.fileStatus ?? null,
    isAvailable: raw.isAvailable ?? true,
    serverPackFileId: raw.serverPackFileId ?? null,
    alternateFileId: raw.alternateFileId ?? null,
    parentProjectFileId: raw.parentProjectFileId ?? null,
    isServerPack: raw.isServerPack ?? false,
  };
}

/**
 * One file of a modpack project by id. Unlike the files listing this also
 * serves server packs and additional files. Null when CurseForge does not
 * serve the file (unknown, not approved yet, or archived). `fresh` asks
 * CurseForge again instead of the gateway's cache.
 */
export async function getModpackFile(
  packProjectId: number,
  fileId: number,
  options: { fresh?: boolean } = {},
): Promise<ModpackFile | null> {
  const answer = await cfFetch(`mods/${packProjectId}/files/${fileId}`, {
    fresh: options.fresh,
  });
  if (answer.status === 404) return null;
  if (!answer.ok) {
    throw new Error(
      `Failed to fetch modpack file ${fileId} (${answer.status})`,
    );
  }
  const body = parseCfResponse(
    curseforgeData(curseforgeFileSchema),
    answer.body,
    "getModpackFile",
  );
  return toModpackFile(body.data);
}

async function getLatestListedModpackFile(
  packProjectId: number,
  fresh: boolean,
): Promise<ModpackFile | null> {
  const answer = await cfFetch(`mods/${packProjectId}/files`, {
    query: { pageSize: 1 },
    fresh,
  });
  if (!answer.ok) {
    throw new Error(`Failed to fetch modpack files (${answer.status})`);
  }
  const body = parseCfResponse(
    curseforgeList(curseforgeFileSchema),
    answer.body,
    "getModpackFiles",
  );
  const latest = body.data[0];
  return latest ? toModpackFile(latest) : null;
}

// Lazy so this module stays importable without a database (unit tests, scripts)
async function loadModpackReadContext(
  packProjectId: number,
): Promise<ModpackReadContext> {
  const { Q } = await import("@/db/index.js");
  const modpack = await Q.modpack.find({ curseforgeProjectId: packProjectId });
  if (!modpack) return { shipsServerPack: false, publishes: [] };
  const publishes = await Q.modpack.publish.findAll(
    { modpackId: modpack.id },
    {
      select: ["clientFileId", "serverPackFileId"],
      orderBy: "clientFileId",
      orderDirection: "desc",
      limit: RECENT_PUBLISHES,
    },
  );
  return {
    shipsServerPack: modpack.shipsServerPack,
    publishes: publishes.map((publish) => ({
      clientFileId: publish.clientFileId,
      serverPackFileId: publish.serverPackFileId,
    })),
  };
}

/**
 * Decide which file is the pack's newest release and which server pack goes
 * with it. The listing's newest file is the release unless the sandbox
 * reported a newer client file that CurseForge already serves by id (the
 * listing is cached per URL on their side and lags behind). The server pack
 * is CurseForge's own link when it has one, else the alternate file when
 * that reads back as a server pack of this release, else what the sandbox
 * reported for the file. The API never links a server pack uploaded
 * through it, so for sandbox releases the report is the usual source.
 */
export async function resolveModpackRelease(
  listed: ModpackFile | null,
  context: ModpackReadContext,
  readFile: (fileId: number) => Promise<ModpackFile | null>,
): Promise<ModpackReleaseResolution> {
  const newest = context.publishes.reduce<ModpackPublishHint | null>(
    (held, publish) =>
      held === null || publish.clientFileId > held.clientFileId
        ? publish
        : held,
    null,
  );

  let file = listed;
  if (newest && (file === null || newest.clientFileId > file.id)) {
    const reported = await readFile(newest.clientFileId);
    if (reported?.isAvailable) file = reported;
  }
  if (file === null) throw new Error("No modpack files found");

  const publish =
    context.publishes.find((p) => p.clientFileId === file.id) ?? null;
  let serverPackFileId = file.serverPackFileId;
  if (serverPackFileId === null && file.alternateFileId !== null) {
    const alternate = await readFile(file.alternateFileId);
    if (alternate?.isServerPack && alternate.parentProjectFileId === file.id) {
      serverPackFileId = alternate.id;
    }
  }
  if (publish && publish.serverPackFileId !== null) {
    if (serverPackFileId === null) {
      serverPackFileId = publish.serverPackFileId;
    } else if (serverPackFileId !== publish.serverPackFileId) {
      logger.warn(
        `Modpack file ${file.id} links server pack ${serverPackFileId} on CurseForge but the sandbox reported ${publish.serverPackFileId}`,
      );
    }
  }

  return {
    file,
    serverPackFileId,
    complete: !context.shipsServerPack || serverPackFileId !== null,
  };
}

type StoredModpackManifest = Omit<
  ModpackManifest,
  "modIds" | "disabledModIds"
> & { modIds: number[]; disabledModIds: number[] };

const manifestStore = createKeyValueStore(16);

function manifestKey(packProjectId: number): string {
  return `modpack:manifest:${packProjectId}`;
}

async function readStoredManifest(
  packProjectId: number,
): Promise<ModpackManifest | undefined> {
  const stored = await readStored<StoredModpackManifest>(
    manifestStore,
    manifestKey(packProjectId),
  );
  if (!stored) return undefined;
  return {
    ...stored,
    modIds: new Set(stored.modIds),
    disabledModIds: new Set(stored.disabledModIds),
  };
}

function storeManifest(
  packProjectId: number,
  manifest: ModpackManifest,
  ttlMs: number,
): Promise<void> {
  const stored: StoredModpackManifest = {
    ...manifest,
    modIds: [...manifest.modIds],
    disabledModIds: [...manifest.disabledModIds],
  };
  return writeStored(manifestStore, manifestKey(packProjectId), stored, ttlMs);
}

const inFlightManifests = new Map<
  number,
  { promise: Promise<ModpackManifest>; seq: number }
>();
let readSeq = 0;

const manifestFailures = new Map<number, number>();
const MANIFEST_FAILURE_BACKOFF_MS = 60_000;
const MAX_MODPACK_ZIP_BYTES = 256 * 1024 * 1024;
const RECENT_PUBLISHES = 5;
const lastForcedReads = new Map<number, number>();
const FORCE_MIN_INTERVAL_MS = 10_000;

/**
 * Returns the pack version and mod project IDs of a modpack's newest release
 *
 * Resolves the release per resolveModpackRelease, downloads the client pack
 * zip and, when the release ships one, the server pack zip too, parses each
 * `manifest.json`, and caches the union for the configured TTL (a minute
 * instead when the pack ships a server pack and none was found, so the
 * next check re-reads). Concurrent cache misses share a single download,
 * and a failed fetch backs off for a minute before retrying. force skips
 * the cache and the backoff, asks CurseForge for the files again instead
 * of the gateway's cache, and waits out a read that started before the
 * call (its context predates whatever the caller just wrote) instead of
 * joining it; forced reads less than ten seconds apart share the first
 * one, which bounds what a looping caller can download.
 */
export async function getModpackManifest(
  packProjectId = MODPACK_PROJECT_ID,
  options: { force?: boolean } = {},
): Promise<ModpackManifest> {
  const lastForced = lastForcedReads.get(packProjectId);
  const force =
    options.force === true &&
    (lastForced === undefined ||
      Date.now() - lastForced >= FORCE_MIN_INTERVAL_MS);
  if (force) lastForcedReads.set(packProjectId, Date.now());
  const callSeq = readSeq;

  if (!force) {
    const stored = await readStoredManifest(packProjectId);
    if (stored) return stored;
  }

  let inFlight = inFlightManifests.get(packProjectId);
  while (force && inFlight && inFlight.seq <= callSeq) {
    await inFlight.promise.catch(() => undefined);
    inFlight = inFlightManifests.get(packProjectId);
  }
  if (inFlight) return inFlight.promise;

  const failedAt = manifestFailures.get(packProjectId);
  if (
    !force &&
    failedAt &&
    Date.now() - failedAt < MANIFEST_FAILURE_BACKOFF_MS
  ) {
    throw new Error(
      `Modpack #${packProjectId} manifest fetch recently failed, backing off`,
    );
  }

  const entry = {
    seq: ++readSeq,
    promise: fetchModpackManifest(packProjectId, force)
      .then((manifest) => {
        manifestFailures.delete(packProjectId);
        return manifest;
      })
      .catch((error) => {
        manifestFailures.set(packProjectId, Date.now());
        throw error;
      })
      .finally(() => {
        if (inFlightManifests.get(packProjectId) === entry) {
          inFlightManifests.delete(packProjectId);
        }
      }),
  };
  inFlightManifests.set(packProjectId, entry);
  return entry.promise;
}

async function fetchModpackManifest(
  packProjectId: number,
  fresh: boolean,
): Promise<ModpackManifest> {
  const context = await loadModpackReadContext(packProjectId);
  const listed = await getLatestListedModpackFile(packProjectId, fresh);
  const { file, serverPackFileId, complete } = await resolveModpackRelease(
    listed,
    context,
    (fileId) => getModpackFile(packProjectId, fileId, { fresh }),
  );

  // Sequential so only one zip is ever buffered at a time
  const client = await downloadPackManifest(packProjectId, file.id);
  const server =
    serverPackFileId === null
      ? null
      : await downloadPackManifest(packProjectId, serverPackFileId);

  const loaders = client.minecraft?.modLoaders ?? [];
  const files = mergeManifestFiles(client.files, server?.files ?? null);
  const result: ModpackManifest = {
    fileId: file.id,
    serverPackFileId,
    displayName: file.displayName,
    version: client.version ?? null,
    minecraftVersion: client.minecraft?.version ?? null,
    modLoader: (loaders.find((l) => l.primary) ?? loaders[0])?.id ?? null,
    publishedAt: file.fileDate,
    entries: files.flatMap((f) =>
      f.fileId === undefined
        ? []
        : [
            {
              projectId: f.projectId,
              fileId: f.fileId,
              required: f.required,
              sides: f.sides,
            },
          ],
    ),
    modIds: new Set(files.map((f) => f.projectId)),
    disabledModIds: manifestDisabledModIds(files),
  };
  await storeManifest(
    packProjectId,
    result,
    complete ? MODPACK_CACHE_TTL : MODPACK_INCOMPLETE_CACHE_TTL,
  );

  logger.info(
    `Cached modpack mod list: ${result.modIds.size} mods from file ${file.id}` +
      (listed?.id === file.id ? "" : " (reported by the sandbox)") +
      (serverPackFileId === null
        ? complete
          ? ""
          : " without the server pack the pack ships"
        : ` and server pack ${serverPackFileId}`),
  );

  return result;
}

const packManifestSchema = z.object({
  version: z.string().optional(),
  minecraft: z
    .object({
      version: z.string().optional(),
      modLoaders: z
        .array(z.object({ id: z.string(), primary: z.boolean().optional() }))
        .optional(),
    })
    .optional(),
  files: z.array(
    z.object({
      projectID: z.number(),
      fileID: z.number().optional(),
      required: z.boolean().optional(),
    }),
  ),
});

async function downloadPackManifest(packProjectId: number, fileId: number) {
  const downloadUrl = await getModFileDownloadUrl(packProjectId, fileId);

  const zipRes = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(CF_DOWNLOAD_TIMEOUT_MS),
  });
  if (!zipRes.ok) {
    throw new Error(
      `Failed to download modpack file ${fileId} (${zipRes.status})`,
    );
  }
  const contentLength = Number(zipRes.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MODPACK_ZIP_BYTES) {
    throw new Error(
      `Modpack file ${fileId} exceeds the ${MAX_MODPACK_ZIP_BYTES} byte limit (${contentLength})`,
    );
  }
  const zip = await JSZip.loadAsync(await zipRes.arrayBuffer());
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error(`No manifest.json in modpack file ${fileId}`);
  }

  const manifest = parseCfResponse(
    packManifestSchema,
    JSON.parse(await manifestFile.async("text")),
    "modpack manifest",
  );
  return {
    version: manifest.version,
    minecraft: manifest.minecraft,
    files: manifest.files.map((f) => ({
      projectId: f.projectID,
      fileId: f.fileID,
      required: f.required ?? true,
    })),
  };
}

/** The set of mod project IDs in a modpack's latest published file. */
export async function getModpackModIds(
  packProjectId = MODPACK_PROJECT_ID,
): Promise<Set<number>> {
  return (await getModpackManifest(packProjectId)).modIds;
}

/**
 * Download a mod file from CurseForge into the given directory using a stream
 * pipeline, returning the saved file's absolute path
 */
export async function downloadModFile(
  modId: number,
  fileId: number,
  destDir: string,
  fileName: string,
): Promise<string> {
  const downloadUrl = await getModFileDownloadUrl(modId, fileId);

  const destPath = path.join(destDir, fileName);
  await fs.promises.mkdir(destDir, { recursive: true });

  const res = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(CF_DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    throw new Error(
      `CurseForge download failed (${res.status}) for mod ${modId} file ${fileId}`,
    );
  }

  const fileStream = fs.createWriteStream(destPath);
  const readable = Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream,
  );
  await pipeline(readable, fileStream);

  return destPath;
}
