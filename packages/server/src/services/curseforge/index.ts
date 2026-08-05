import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import JSZip from "jszip";
import config from "@/config";

// CurseForge API vocabulary
export const CURSEFORGE_MINECRAFT_GAME_ID = 432;

export const CurseForgeClass = {
  mods: 6,
  modpacks: 4471,
} as const;

export const CurseForgeLoader = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6,
} as const;

const CURSEFORGE_API = config.curseforge.apiBaseUrl;
// CloudFront has been seen holding requests ~90s before returning a 504;
// without timeouts those calls stack up behind a single stuck mutation
const CF_FETCH_TIMEOUT_MS = 15_000;
const CF_DOWNLOAD_TIMEOUT_MS = 120_000;
const MINECRAFT_GAME_ID = CURSEFORGE_MINECRAFT_GAME_ID;
const MOD_CLASS_ID: number = CurseForgeClass.mods;
const NEOFORGE_LOADER_TYPE: number = CurseForgeLoader.neoforge;
const DEFAULT_GAME_VERSION: string = config.curseforge.defaultGameVersion;
const MODPACK_PROJECT_ID: number = config.curseforge.modpackProjectId;
const MODPACK_CACHE_TTL = config.curseforge.modpackCacheTtlMs;

/** Returns the auth and accept headers required for every CurseForge API request */
function cfHeaders(): Record<string, string> {
  return {
    "x-api-key": config.curseforge.apiKey!,
    Accept: "application/json",
  };
}

/** Throws if the CurseForge API key is missing from config */
function ensureApiKey(): void {
  if (!config.curseforge.apiKey) {
    throw new Error("CurseForge API key not configured");
  }
}

export interface CurseForgeTarget {
  gameVersion?: string;
  modLoaderType?: number;
}

export interface CurseForgeSearchOptions extends CurseForgeTarget {
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

export interface CurseForgeProjectData {
  id: number;
  classId: number;
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string;
  thumbnailUrl: string | null;
  authors: Array<{ id: number; name: string; url: string; avatarUrl?: string }>;
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
  dateModified: string;
  dateReleased: string;
  latestFilesIndexes: Array<{
    gameVersion: string;
    fileId: number;
    filename: string;
    releaseType: number;
    modLoader: number | null;
  }>;
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
 * Defaults target the current server setup (NeoForge mods for the default game version).
 *
 * @param query - Search string to filter projects by name
 * @param pageSize - Maximum number of results to return (default: 50)
 * @returns List of matching projects, each annotated with whether it is already in the modpack
 */
export async function searchMods(
  query: string,
  pageSize = 50,
  options: CurseForgeSearchOptions = {},
): Promise<CurseForgeSearchResult[]> {
  ensureApiKey();

  const {
    gameVersion = DEFAULT_GAME_VERSION,
    modLoaderType = NEOFORGE_LOADER_TYPE,
    classId = MOD_CLASS_ID,
    packProjectId = MODPACK_PROJECT_ID,
  } = options;

  const url = new URL(`${CURSEFORGE_API}/v1/mods/search`);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("searchFilter", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("sortField", "2"); // popularity
  url.searchParams.set("sortOrder", "desc");
  url.searchParams.set("classId", String(classId));
  url.searchParams.set("modLoaderType", String(modLoaderType));
  url.searchParams.set("gameVersion", gameVersion);

  const res = await fetch(url.toString(), {
    headers: cfHeaders(),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge search failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    data: Array<{
      id: number;
      name: string;
      slug: string;
      summary?: string;
      authors?: Array<{ name: string }>;
      downloadCount?: number;
      links: { websiteUrl: string };
      logo?: { thumbnailUrl: string };
    }>;
  };

  let modpackModIds: Set<number>;
  try {
    modpackModIds =
      packProjectId === null
        ? new Set<number>()
        : await getModpackModIds(packProjectId);
  } catch {
    modpackModIds = new Set();
  }

  return body.data.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    url: m.links.websiteUrl,
    thumbnailUrl: m.logo?.thumbnailUrl,
    summary: m.summary ?? null,
    primaryAuthor: m.authors?.[0]?.name ?? null,
    downloadCount: m.downloadCount ?? 0,
    inModpack: modpackModIds.has(m.id),
  }));
}

/**
 * Fetch the available files for a mod, filtered by game version and mod loader
 *
 * Only optional (relationType 2) and required (relationType 3) dependencies are included.
 *
 * @param modId - CurseForge project ID of the mod
 * @param gameVersion - Minecraft version to filter files by (default: 1.21.1)
 * @param modLoaderType - CurseForge loader type to filter files by (default: NeoForge)
 * @returns List of mod files with their metadata and filtered dependencies
 */
export async function getModFiles(
  modId: number,
  gameVersion = DEFAULT_GAME_VERSION,
  modLoaderType = NEOFORGE_LOADER_TYPE,
): Promise<CurseForgeModFile[]> {
  ensureApiKey();

  const url = new URL(`${CURSEFORGE_API}/v1/mods/${modId}/files`);
  url.searchParams.set("gameVersion", gameVersion);
  url.searchParams.set("modLoaderType", String(modLoaderType));

  const res = await fetch(url.toString(), {
    headers: cfHeaders(),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge getModFiles failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    data: Array<{
      id: number;
      displayName: string;
      fileName: string;
      downloadUrl: string | null;
      fileDate: string;
      fileLength: number;
      releaseType: number;
      gameVersions: string[];
      hashes?: Array<{ value: string; algo: number }>;
      dependencies?: Array<{ modId: number; relationType: number }>;
    }>;
  };

  return body.data.map((f) => ({
    id: f.id,
    displayName: f.displayName,
    fileName: f.fileName,
    downloadUrl: f.downloadUrl,
    fileDate: f.fileDate,
    fileLength: f.fileLength,
    releaseType: f.releaseType,
    gameVersions: f.gameVersions,
    hashes: f.hashes ?? [],
    dependencies: (f.dependencies ?? []).filter(
      (d) => d.relationType === 2 || d.relationType === 3,
    ),
  }));
}

interface RawCurseForgeMod {
  id: number;
  classId: number;
  slug: string;
  name: string;
  summary: string;
  links: { websiteUrl: string };
  logo?: { thumbnailUrl: string };
  authors: Array<{ id: number; name: string; url: string; avatarUrl?: string }>;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
    iconUrl?: string;
  }>;
  screenshots?: Array<{ title: string; thumbnailUrl: string; url: string }>;
  downloadCount: number;
  isAvailable: boolean;
  allowModDistribution?: boolean | null;
  dateModified: string;
  dateReleased: string;
  latestFilesIndexes?: Array<{
    gameVersion: string;
    fileId: number;
    filename: string;
    releaseType: number;
    modLoader?: number;
  }>;
}

function mapProject(raw: RawCurseForgeMod): CurseForgeProjectData {
  return {
    id: raw.id,
    classId: raw.classId,
    slug: raw.slug,
    name: raw.name,
    summary: raw.summary,
    websiteUrl: raw.links.websiteUrl,
    thumbnailUrl: raw.logo?.thumbnailUrl ?? null,
    authors: raw.authors,
    categories: raw.categories,
    screenshots: raw.screenshots ?? [],
    downloadCount: raw.downloadCount,
    isAvailable: raw.isAvailable,
    allowModDistribution: raw.allowModDistribution ?? null,
    dateModified: raw.dateModified,
    dateReleased: raw.dateReleased,
    latestFilesIndexes: (raw.latestFilesIndexes ?? []).map((idx) => ({
      gameVersion: idx.gameVersion,
      fileId: idx.fileId,
      filename: idx.filename,
      releaseType: idx.releaseType,
      modLoader: idx.modLoader ?? null,
    })),
  };
}

/**
 * Fetch full metadata for a single CurseForge project
 *
 * @param projectId - CurseForge project ID
 * @returns Structured project data including authors, categories, screenshots, and file indexes
 */
export async function getMod(
  projectId: number,
): Promise<CurseForgeProjectData> {
  ensureApiKey();

  const res = await fetch(`${CURSEFORGE_API}/v1/mods/${projectId}`, {
    headers: cfHeaders(),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge getMod failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as { data: RawCurseForgeMod };
  return mapProject(body.data);
}

/**
 * Fetch full metadata for multiple CurseForge projects in one batch request
 *
 * @param projectIds - CurseForge project IDs
 * @returns Structured project data for every ID the API resolved
 */
export async function getMods(
  projectIds: number[],
): Promise<CurseForgeProjectData[]> {
  ensureApiKey();
  if (projectIds.length === 0) return [];

  const res = await fetch(`${CURSEFORGE_API}/v1/mods`, {
    method: "POST",
    headers: { ...cfHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ modIds: projectIds }),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge getMods failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as { data: RawCurseForgeMod[] };
  return body.data.map(mapProject);
}

/**
 * Fetch the direct download URL for a specific mod file
 *
 * @param modId - CurseForge project ID of the mod
 * @param fileId - CurseForge file ID to get the download URL for
 * @returns Direct download URL string
 */
export async function getModFileDownloadUrl(
  modId: number,
  fileId: number,
): Promise<string> {
  ensureApiKey();

  const res = await fetch(
    `${CURSEFORGE_API}/v1/mods/${modId}/files/${fileId}/download-url`,
    { headers: cfHeaders(), signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `CurseForge getDownloadUrl failed (${res.status}): ${text}`,
    );
  }

  const body = (await res.json()) as { data: string };
  return body.data;
}

/**
 * Resolve a list of dependency mod IDs to their display info and best compatible file
 *
 * Checks whether each dependency is already present in the given pack mod set.
 * Best file selection prefers the target loader + game version, falling back to
 * game version alone when no loader-specific file is available.
 *
 * @param modIds - CurseForge project IDs to resolve
 * @param packModIds - Set of mod IDs already present in the modpack
 * @param target - Game version and loader to select best files for (defaults to server setup)
 * @returns Resolved dependency info including name, thumbnail, pack membership, and best file
 */
export async function resolveDependencies(
  modIds: number[],
  packModIds: Set<number>,
  target: CurseForgeTarget = {},
): Promise<ResolvedDependency[]> {
  ensureApiKey();
  if (modIds.length === 0) return [];

  const {
    gameVersion = DEFAULT_GAME_VERSION,
    modLoaderType = NEOFORGE_LOADER_TYPE,
  } = target;

  const res = await fetch(`${CURSEFORGE_API}/v1/mods`, {
    method: "POST",
    headers: { ...cfHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ modIds }),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to resolve dependencies (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    data: Array<{
      id: number;
      name: string;
      links: { websiteUrl: string };
      logo?: { thumbnailUrl: string };
      latestFilesIndexes: Array<{
        gameVersion: string;
        fileId: number;
        filename: string;
        modLoader: number;
      }>;
    }>;
  };

  return body.data.map((mod) => {
    const indexes = mod.latestFilesIndexes;
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
      thumbnailUrl: mod.logo?.thumbnailUrl,
      inPack: packModIds.has(mod.id),
      bestFile: bestIndex
        ? { id: bestIndex.fileId, fileName: bestIndex.filename }
        : null,
    };
  });
}

/**
 * Fetch dependency info for multiple mod files in a single batch request
 *
 * Only optional (relationType 2) and required (relationType 3) dependencies are returned.
 *
 * @param fileIds - CurseForge file IDs to look up
 * @returns Per-file records containing the owning mod ID and its filtered dependencies
 */
export async function getFilesDependencies(fileIds: number[]): Promise<
  Array<{
    fileId: number;
    modId: number;
    dependencies: Array<{ modId: number; relationType: number }>;
  }>
> {
  ensureApiKey();
  if (fileIds.length === 0) return [];

  const res = await fetch(`${CURSEFORGE_API}/v1/mods/files`, {
    method: "POST",
    headers: { ...cfHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch file dependencies (${res.status}): ${text}`,
    );
  }

  const body = (await res.json()) as {
    data: Array<{
      id: number;
      modId: number;
      dependencies?: Array<{ modId: number; relationType: number }>;
    }>;
  };

  return body.data.map((f) => ({
    fileId: f.id,
    modId: f.modId,
    dependencies: (f.dependencies ?? []).filter(
      (d) => d.relationType === 2 || d.relationType === 3,
    ),
  }));
}

export interface ModpackManifest {
  version: string | null;
  modIds: Set<number>;
}

const modpackCache = new Map<
  number,
  { manifest: ModpackManifest; fetchedAt: number }
>();

/**
 * Returns the pack version and mod project IDs of a modpack's latest published file
 *
 * Downloads the modpack zip, parses `manifest.json`, and caches the result for 1 hour.
 * Prefers the server pack file when available, falling back to the client pack.
 */
export async function getModpackManifest(
  packProjectId = MODPACK_PROJECT_ID,
): Promise<ModpackManifest> {
  const cached = modpackCache.get(packProjectId);
  if (cached && Date.now() - cached.fetchedAt < MODPACK_CACHE_TTL) {
    return cached.manifest;
  }

  ensureApiKey();

  const filesRes = await fetch(
    `${CURSEFORGE_API}/v1/mods/${packProjectId}/files?pageSize=1`,
    { headers: cfHeaders(), signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS) },
  );
  if (!filesRes.ok) {
    throw new Error(`Failed to fetch modpack files (${filesRes.status})`);
  }

  const filesBody = (await filesRes.json()) as {
    data: Array<{ id: number; serverPackFileId: number | null }>;
  };
  const latestFile = filesBody.data[0];
  if (!latestFile) throw new Error("No modpack files found");

  // Use server pack if available, otherwise client pack
  const fileId = latestFile.serverPackFileId ?? latestFile.id;

  const dlRes = await fetch(
    `${CURSEFORGE_API}/v1/mods/${packProjectId}/files/${fileId}/download-url`,
    { headers: cfHeaders(), signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS) },
  );
  if (!dlRes.ok) {
    throw new Error(`Failed to get modpack download URL (${dlRes.status})`);
  }
  const { data: downloadUrl } = (await dlRes.json()) as { data: string };

  const zipRes = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(CF_DOWNLOAD_TIMEOUT_MS),
  });
  if (!zipRes.ok) {
    throw new Error(`Failed to download modpack zip (${zipRes.status})`);
  }
  const zipBuf = await zipRes.arrayBuffer();

  const zip = await JSZip.loadAsync(zipBuf);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("No manifest.json in modpack");

  const manifest = JSON.parse(await manifestFile.async("text")) as {
    version?: string;
    files: Array<{ projectID: number }>;
  };

  const result: ModpackManifest = {
    version: manifest.version ?? null,
    modIds: new Set(manifest.files.map((f) => f.projectID)),
  };
  modpackCache.set(packProjectId, { manifest: result, fetchedAt: Date.now() });

  logger.info(
    `Cached modpack mod list: ${result.modIds.size} mods from file ${fileId}`,
  );

  return result;
}

/** The set of mod project IDs in a modpack's latest published file. */
export async function getModpackModIds(
  packProjectId = MODPACK_PROJECT_ID,
): Promise<Set<number>> {
  return (await getModpackManifest(packProjectId)).modIds;
}

/**
 * Download a mod file from CurseForge and save it to disk using a stream pipeline
 *
 * @param modId - CurseForge project ID of the mod
 * @param fileId - CurseForge file ID to download
 * @param destDir - Directory to write the file into (created if it does not exist)
 * @param fileName - Name to give the saved file
 * @returns Absolute path to the downloaded file
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
