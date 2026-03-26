import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import config from "@/config";

const CURSEFORGE_API = "https://api.curseforge.com";
const MINECRAFT_GAME_ID = 432;
const NEOFORGE_LOADER_TYPE = 6;
const DEFAULT_GAME_VERSION = "1.21.1";

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
  gameVersions: string[];
}

// =============================================================================
// API functions
// =============================================================================

export async function searchMods(
  query: string,
  pageSize = 20,
): Promise<CurseForgeSearchResult[]> {
  ensureApiKey();

  const url = new URL(`${CURSEFORGE_API}/v1/mods/search`);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("searchFilter", query);
  url.searchParams.set("pageSize", String(pageSize));
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

  return body.data.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    url: m.links.websiteUrl,
    thumbnailUrl: m.logo?.thumbnailUrl,
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
      gameVersions: string[];
    }>;
  };

  return body.data.map((f) => ({
    id: f.id,
    displayName: f.displayName,
    fileName: f.fileName,
    downloadUrl: f.downloadUrl,
    fileLength: f.fileLength,
    gameVersions: f.gameVersions,
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
