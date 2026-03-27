import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import JSZip from "jszip";
import config from "@/config";

const CURSEFORGE_API = "https://api.curseforge.com";
const MINECRAFT_GAME_ID = 432;
const NEOFORGE_LOADER_TYPE = 6;
const DEFAULT_GAME_VERSION = "1.21.1";
const MODPACK_PROJECT_ID = 1316177;
const MODPACK_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function cfHeaders(): Record<string, string> {
  return {
    "x-api-key": config.curseforge.apiKey!,
    Accept: "application/json",
  };
}

function ensureApiKey(): void {
  if (!config.curseforge.apiKey) {
    throw new Error("CurseForge API key not configured");
  }
}

// =============================================================================
// Types
// =============================================================================

export interface CurseForgeSearchResult {
  id: number;
  name: string;
  slug: string;
  url: string;
  thumbnailUrl?: string;
  inModpack: boolean;
}

export interface CurseForgeModDetail {
  id: number;
  name: string;
  slug: string;
  url: string;
  summary: string;
  thumbnailUrl?: string;
  downloadCount: number;
}

export interface CurseForgeModFile {
  id: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  fileLength: number;
  releaseType: number;
  gameVersions: string[];
  dependencies: Array<{ modId: number; relationType: number }>;
}

export interface ResolvedDependency {
  modId: number;
  modName: string;
  modUrl?: string;
  thumbnailUrl?: string;
  inPack: boolean;
  bestFile: { id: number; fileName: string } | null;
}

export interface RemovableDep {
  modId: number;
  modName: string;
  safe: boolean;
  neededBy: string[];
}

// =============================================================================
// API functions
// =============================================================================

export async function searchMods(
  query: string,
  pageSize = 50,
): Promise<CurseForgeSearchResult[]> {
  ensureApiKey();

  const url = new URL(`${CURSEFORGE_API}/v1/mods/search`);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("searchFilter", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("sortField", "2"); // popularity
  url.searchParams.set("sortOrder", "desc");
  url.searchParams.set("classId", "6"); // mods only
  url.searchParams.set("modLoaderType", String(NEOFORGE_LOADER_TYPE));
  url.searchParams.set("gameVersion", DEFAULT_GAME_VERSION);

  const res = await fetch(url.toString(), { headers: cfHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge search failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    data: Array<{
      id: number;
      name: string;
      slug: string;
      links: { websiteUrl: string };
      logo?: { thumbnailUrl: string };
    }>;
  };

  let modpackModIds: Set<number>;
  try {
    modpackModIds = await getModpackModIds();
  } catch {
    modpackModIds = new Set();
  }

  return body.data.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    url: m.links.websiteUrl,
    thumbnailUrl: m.logo?.thumbnailUrl,
    inModpack: modpackModIds.has(m.id),
  }));
}

export async function getMod(modId: number): Promise<CurseForgeModDetail> {
  ensureApiKey();

  const res = await fetch(`${CURSEFORGE_API}/v1/mods/${modId}`, {
    headers: cfHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge getMod failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    data: {
      id: number;
      name: string;
      slug: string;
      summary: string;
      downloadCount: number;
      links: { websiteUrl: string };
      logo?: { thumbnailUrl: string };
    };
  };

  return {
    id: body.data.id,
    name: body.data.name,
    slug: body.data.slug,
    url: body.data.links.websiteUrl,
    summary: body.data.summary,
    thumbnailUrl: body.data.logo?.thumbnailUrl,
    downloadCount: body.data.downloadCount,
  };
}

export async function getModFiles(
  modId: number,
  gameVersion = DEFAULT_GAME_VERSION,
): Promise<CurseForgeModFile[]> {
  ensureApiKey();

  const url = new URL(`${CURSEFORGE_API}/v1/mods/${modId}/files`);
  url.searchParams.set("gameVersion", gameVersion);
  url.searchParams.set("modLoaderType", String(NEOFORGE_LOADER_TYPE));

  const res = await fetch(url.toString(), { headers: cfHeaders() });
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
      fileLength: number;
      releaseType: number;
      gameVersions: string[];
      dependencies?: Array<{ modId: number; relationType: number }>;
    }>;
  };

  return body.data.map((f) => ({
    id: f.id,
    displayName: f.displayName,
    fileName: f.fileName,
    downloadUrl: f.downloadUrl,
    fileLength: f.fileLength,
    releaseType: f.releaseType,
    gameVersions: f.gameVersions,
    dependencies: (f.dependencies ?? []).filter(
      (d) => d.relationType === 2 || d.relationType === 3,
    ),
  }));
}

export async function getModFileDownloadUrl(
  modId: number,
  fileId: number,
): Promise<string> {
  ensureApiKey();

  const res = await fetch(
    `${CURSEFORGE_API}/v1/mods/${modId}/files/${fileId}/download-url`,
    { headers: cfHeaders() },
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

// =============================================================================
// Dependency resolution
// =============================================================================

/**
 * Resolve dependency mod IDs to display info (name, thumbnail, best compatible file).
 * Also checks whether each dependency is already present in a given pack.
 */
export async function resolveDependencies(
  modIds: number[],
  packModIds: Set<number>,
): Promise<ResolvedDependency[]> {
  ensureApiKey();
  if (modIds.length === 0) return [];

  const res = await fetch(`${CURSEFORGE_API}/v1/mods`, {
    method: "POST",
    headers: { ...cfHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ modIds }),
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
        idx.gameVersion === DEFAULT_GAME_VERSION &&
        idx.modLoader === NEOFORGE_LOADER_TYPE,
    );
    if (!bestIndex) {
      bestIndex = indexes.find(
        (idx) => idx.gameVersion === DEFAULT_GAME_VERSION,
      );
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
 * Fetch dependency info for multiple files by their file IDs.
 * Returns modId and filtered dependencies (required + optional) for each file.
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

// =============================================================================
// Published modpack mod list (cached)
// =============================================================================

let modpackCache: { modIds: Set<number>; fetchedAt: number } | null = null;

/**
 * Returns the set of CurseForge mod project IDs in the latest published modpack.
 * Downloads the modpack zip, parses manifest.json, and caches for 1 hour.
 */
export async function getModpackModIds(): Promise<Set<number>> {
  if (modpackCache && Date.now() - modpackCache.fetchedAt < MODPACK_CACHE_TTL) {
    return modpackCache.modIds;
  }

  ensureApiKey();

  // Get the latest modpack file
  const filesRes = await fetch(
    `${CURSEFORGE_API}/v1/mods/${MODPACK_PROJECT_ID}/files?pageSize=1`,
    { headers: cfHeaders() },
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

  // Download the zip
  const dlRes = await fetch(
    `${CURSEFORGE_API}/v1/mods/${MODPACK_PROJECT_ID}/files/${fileId}/download-url`,
    { headers: cfHeaders() },
  );
  if (!dlRes.ok) {
    throw new Error(`Failed to get modpack download URL (${dlRes.status})`);
  }
  const { data: downloadUrl } = (await dlRes.json()) as { data: string };

  const zipRes = await fetch(downloadUrl);
  if (!zipRes.ok) {
    throw new Error(`Failed to download modpack zip (${zipRes.status})`);
  }
  const zipBuf = await zipRes.arrayBuffer();

  // Parse manifest
  const zip = await JSZip.loadAsync(zipBuf);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("No manifest.json in modpack");

  const manifest = JSON.parse(await manifestFile.async("text")) as {
    files: Array<{ projectID: number }>;
  };

  const modIds = new Set(manifest.files.map((f) => f.projectID));
  modpackCache = { modIds, fetchedAt: Date.now() };

  logger.info(
    `Cached modpack mod list: ${modIds.size} mods from file ${fileId}`,
  );

  return modIds;
}

// =============================================================================
// File downloads
// =============================================================================

export async function downloadModFile(
  modId: number,
  fileId: number,
  destDir: string,
  fileName: string,
): Promise<string> {
  const downloadUrl = await getModFileDownloadUrl(modId, fileId);

  const destPath = path.join(destDir, fileName);
  await fs.promises.mkdir(destDir, { recursive: true });

  const res = await fetch(downloadUrl);
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
