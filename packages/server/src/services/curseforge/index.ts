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
// The batch endpoints reject oversized id lists in the request body
const CF_BATCH_SIZE = 100;

function toBatches<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += CF_BATCH_SIZE) {
    batches.push(items.slice(i, i + CF_BATCH_SIZE));
  }
  return batches;
}
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
 * Defaults target the current server setup (NeoForge mods for the default game
 * version). Results are annotated with whether they are already in the modpack.
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
 * Fetch full metadata for a single CurseForge project, including authors,
 * categories, screenshots, and file indexes
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
 * Fetch full metadata for multiple CurseForge projects in batched requests,
 * returning data for every ID the API resolved
 */
export async function getMods(
  projectIds: number[],
): Promise<CurseForgeProjectData[]> {
  ensureApiKey();
  if (projectIds.length === 0) return [];

  const results: CurseForgeProjectData[] = [];
  for (const batch of toBatches(projectIds)) {
    const res = await fetch(`${CURSEFORGE_API}/v1/mods`, {
      method: "POST",
      headers: { ...cfHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ modIds: batch }),
      signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`CurseForge getMods failed (${res.status}): ${text}`);
    }

    const body = (await res.json()) as { data: RawCurseForgeMod[] };
    results.push(...body.data.map(mapProject));
  }
  return results;
}

/** Fetch the direct download URL for a specific mod file */
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
 * Resolve a list of dependency mod IDs to their display info and best
 * compatible file in batched requests
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
  ensureApiKey();
  if (modIds.length === 0) return [];

  const {
    gameVersion = DEFAULT_GAME_VERSION,
    modLoaderType = NEOFORGE_LOADER_TYPE,
  } = target;

  type RawDependencyMod = {
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
  };

  const mods: RawDependencyMod[] = [];
  for (const batch of toBatches(modIds)) {
    const res = await fetch(`${CURSEFORGE_API}/v1/mods`, {
      method: "POST",
      headers: { ...cfHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ modIds: batch }),
      signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Failed to resolve dependencies (${res.status}): ${text}`,
      );
    }

    const body = (await res.json()) as { data: RawDependencyMod[] };
    mods.push(...body.data);
  }

  return mods.map((mod) => {
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
 * Fetch per-file dependency info for multiple mod files in batched requests
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
  ensureApiKey();
  if (fileIds.length === 0) return [];

  const results: Array<{
    fileId: number;
    modId: number;
    dependencies: Array<{ modId: number; relationType: number }>;
  }> = [];
  for (const batch of toBatches(fileIds)) {
    const res = await fetch(`${CURSEFORGE_API}/v1/mods/files`, {
      method: "POST",
      headers: { ...cfHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: batch }),
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

    results.push(
      ...body.data.map((f) => ({
        fileId: f.id,
        modId: f.modId,
        dependencies: (f.dependencies ?? []).filter(
          (d) => d.relationType === 2 || d.relationType === 3,
        ),
      })),
    );
  }
  return results;
}

export interface ModpackManifest {
  version: string | null;
  modIds: Set<number>;
}

const modpackCache = new Map<
  number,
  { manifest: ModpackManifest; fetchedAt: number }
>();

const inFlightManifests = new Map<number, Promise<ModpackManifest>>();

/**
 * Returns the pack version and mod project IDs of a modpack's latest published file
 *
 * Downloads the modpack zip, parses `manifest.json`, and caches the result for the configured TTL.
 * Concurrent cache misses share a single download. Prefers the server pack
 * file when available, falling back to the client pack.
 */
export async function getModpackManifest(
  packProjectId = MODPACK_PROJECT_ID,
): Promise<ModpackManifest> {
  const cached = modpackCache.get(packProjectId);
  if (cached && Date.now() - cached.fetchedAt < MODPACK_CACHE_TTL) {
    return cached.manifest;
  }

  const inFlight = inFlightManifests.get(packProjectId);
  if (inFlight) return inFlight;

  const promise = fetchModpackManifest(packProjectId).finally(() =>
    inFlightManifests.delete(packProjectId),
  );
  inFlightManifests.set(packProjectId, promise);
  return promise;
}

async function fetchModpackManifest(
  packProjectId: number,
): Promise<ModpackManifest> {
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
