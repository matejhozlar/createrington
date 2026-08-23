import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import JSZip from "jszip";
import { z } from "zod";
import config from "@/config";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

// CurseForge API vocabulary
export const CURSEFORGE_MINECRAFT_GAME_ID = 432;

export const CurseForgeClass = CURSEFORGE_CLASSES;

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

// Responses are validated before their values are persisted or mapped, so a
// shape change upstream fails loudly instead of writing NaN / Invalid Date
function parseCfResponse<T extends z.ZodTypeAny>(
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

const rawFileIndexSchema = z.object({
  gameVersion: z.string(),
  fileId: z.number(),
  filename: z.string(),
  releaseType: z.number(),
  modLoader: z.number().nullish(),
});

const rawModSchema = z.object({
  id: z.number(),
  classId: z.number(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  links: z.object({ websiteUrl: z.string() }),
  logo: z.object({ thumbnailUrl: z.string() }).nullish(),
  authors: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      url: z.string(),
      avatarUrl: z.string().nullish(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      slug: z.string(),
      iconUrl: z.string().optional(),
    }),
  ),
  screenshots: z
    .array(
      z.object({
        title: z.string(),
        thumbnailUrl: z.string(),
        url: z.string(),
      }),
    )
    .nullish(),
  downloadCount: z.number(),
  isAvailable: z.boolean(),
  allowModDistribution: z.boolean().nullish(),
  dateModified: z.string(),
  dateReleased: z.string(),
  latestFiles: z
    .array(z.object({ gameVersions: z.array(z.string()).nullish() }))
    .nullish(),
  latestFilesIndexes: z.array(rawFileIndexSchema).nullish(),
});

const rawSearchResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  summary: z.string().nullish(),
  authors: z.array(z.object({ name: z.string() })).nullish(),
  downloadCount: z.number().nullish(),
  links: z.object({ websiteUrl: z.string() }),
  logo: z.object({ thumbnailUrl: z.string() }).nullish(),
});

const rawModFileSchema = z.object({
  id: z.number(),
  displayName: z.string(),
  fileName: z.string(),
  downloadUrl: z.string().nullable(),
  fileDate: z.string(),
  fileLength: z.number(),
  releaseType: z.number(),
  gameVersions: z.array(z.string()),
  hashes: z.array(z.object({ value: z.string(), algo: z.number() })).nullish(),
  dependencies: z
    .array(z.object({ modId: z.number(), relationType: z.number() }))
    .nullish(),
});

const rawFileDependenciesSchema = z.object({
  id: z.number(),
  modId: z.number(),
  dependencies: z
    .array(z.object({ modId: z.number(), relationType: z.number() }))
    .nullish(),
});

const rawFileDetailSchema = z.object({
  id: z.number(),
  modId: z.number(),
  displayName: z.string().nullish(),
  fileName: z.string().nullish(),
  fileDate: z.string().nullish(),
  releaseType: z.number().nullish(),
});

const rawModpackFileSchema = z.object({
  id: z.number(),
  modId: z.number(),
  displayName: z.string().nullish(),
  fileDate: z.string().nullish(),
  fileStatus: z.number().nullish(),
  isAvailable: z.boolean().nullish(),
  serverPackFileId: z.number().nullish(),
  alternateFileId: z.number().nullish(),
  parentProjectFileId: z.number().nullish(),
  isServerPack: z.boolean().nullish(),
});

const rawDependencyModSchema = z.object({
  id: z.number(),
  name: z.string(),
  links: z.object({ websiteUrl: z.string() }),
  logo: z.object({ thumbnailUrl: z.string() }).nullish(),
  latestFilesIndexes: z.array(rawFileIndexSchema).nullish(),
});
const MINECRAFT_GAME_ID = CURSEFORGE_MINECRAFT_GAME_ID;
const MOD_CLASS_ID: number = CurseForgeClass.mods;
const NEOFORGE_LOADER_TYPE: number = CurseForgeLoader.neoforge;
const DEFAULT_GAME_VERSION: string = config.curseforge.defaultGameVersion;
const MODPACK_PROJECT_ID: number = config.curseforge.modpackProjectId;
const MODPACK_CACHE_TTL = config.curseforge.modpackCacheTtlMs;
const MODPACK_INCOMPLETE_CACHE_TTL =
  config.curseforge.modpackIncompleteCacheTtlMs;

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

export type CurseForgeEnvironmentHint = "client" | "server" | "both";

export interface CurseForgeProjectData {
  id: number;
  classId: number;
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string;
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

  const body = parseCfResponse(
    z.object({ data: z.array(rawSearchResultSchema) }),
    await res.json(),
    "search",
  );

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
 * Look up a single project by its URL slug (exact match within a class).
 * Returns null when nothing matches or the slug is ambiguous within the class.
 */
export async function findModBySlug(
  slug: string,
  classId: number = MOD_CLASS_ID,
): Promise<{ id: number; name: string } | null> {
  ensureApiKey();

  const url = new URL(`${CURSEFORGE_API}/v1/mods/search`);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("classId", String(classId));
  url.searchParams.set("slug", slug);

  const res = await fetch(url.toString(), {
    headers: cfHeaders(),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge slug lookup failed (${res.status}): ${text}`);
  }

  const body = parseCfResponse(
    z.object({
      data: z.array(z.object({ id: z.number(), name: z.string() })),
    }),
    await res.json(),
    "slug lookup",
  );

  if (body.data.length > 1) {
    logger.warn(
      `CurseForge slug lookup for "${slug}" (class ${classId}) returned ${body.data.length} projects, treating as not found`,
    );
    return null;
  }

  return body.data[0] ?? null;
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

  const body = parseCfResponse(
    z.object({ data: z.array(rawModFileSchema) }),
    await res.json(),
    "getModFiles",
  );

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

type RawCurseForgeMod = z.infer<typeof rawModSchema>;

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
  ensureApiKey();

  const res = await fetch(`${CURSEFORGE_API}/v1/mods/${projectId}`, {
    headers: cfHeaders(),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge getMod failed (${res.status}): ${text}`);
  }

  const body = parseCfResponse(
    z.object({ data: rawModSchema }),
    await res.json(),
    "getMod",
  );
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

    const body = parseCfResponse(
      z.object({ data: z.array(rawModSchema) }),
      await res.json(),
      "getMods",
    );
    results.push(...body.data.map(mapProject));
  }
  return results;
}

let minecraftVersionsCache: { versions: string[]; fetchedAt: number } | null =
  null;
const MINECRAFT_VERSIONS_TTL = 60 * 60 * 1000;

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map((part) => parseInt(part, 10));
  const pb = b.split(".").map((part) => parseInt(part, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Fetch all released Minecraft versions, newest first (cached for an hour) */
export async function getMinecraftVersions(): Promise<string[]> {
  if (
    minecraftVersionsCache &&
    Date.now() - minecraftVersionsCache.fetchedAt < MINECRAFT_VERSIONS_TTL
  ) {
    return minecraftVersionsCache.versions;
  }
  ensureApiKey();

  const res = await fetch(`${CURSEFORGE_API}/v1/minecraft/version`, {
    headers: cfHeaders(),
    signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `CurseForge getMinecraftVersions failed (${res.status}): ${text}`,
    );
  }

  const body = parseCfResponse(
    z.object({ data: z.array(z.object({ versionString: z.string() })) }),
    await res.json(),
    "getMinecraftVersions",
  );
  const versions = body.data
    .map((entry) => entry.versionString)
    .sort(compareVersionsDesc);
  minecraftVersionsCache = { versions, fetchedAt: Date.now() };
  return versions;
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

  const mods: Array<z.infer<typeof rawDependencyModSchema>> = [];
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

    const body = parseCfResponse(
      z.object({ data: z.array(rawDependencyModSchema) }),
      await res.json(),
      "resolveDependencies",
    );
    mods.push(...body.data);
  }

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
export interface CurseForgeFileDetail {
  fileId: number;
  projectId: number;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  releaseType: number | null;
}

/** Identity of specific mod files, batched. Unknown ids are simply absent. */
export async function getFilesDetails(
  fileIds: number[],
): Promise<CurseForgeFileDetail[]> {
  ensureApiKey();
  if (fileIds.length === 0) return [];

  const results: CurseForgeFileDetail[] = [];
  for (const batch of toBatches(fileIds)) {
    const res = await fetch(`${CURSEFORGE_API}/v1/mods/files`, {
      method: "POST",
      headers: { ...cfHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: batch }),
      signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to fetch file details (${res.status}): ${text}`);
    }

    const body = parseCfResponse(
      z.object({ data: z.array(rawFileDetailSchema) }),
      await res.json(),
      "getFilesDetails",
    );

    results.push(
      ...body.data.map((f) => ({
        fileId: f.id,
        projectId: f.modId,
        displayName: f.displayName ?? null,
        fileName: f.fileName ?? null,
        fileDate: f.fileDate ?? null,
        releaseType: f.releaseType ?? null,
      })),
    );
  }
  return results;
}

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

    const body = parseCfResponse(
      z.object({ data: z.array(rawFileDependenciesSchema) }),
      await res.json(),
      "getFilesDependencies",
    );

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
  fileDate: string | null;
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

function toModpackFile(raw: z.infer<typeof rawModpackFileSchema>): ModpackFile {
  return {
    id: raw.id,
    projectId: raw.modId,
    displayName: raw.displayName ?? null,
    fileDate: raw.fileDate ?? null,
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
 * serve the file (unknown, not approved yet, or archived).
 */
export async function getModpackFile(
  packProjectId: number,
  fileId: number,
): Promise<ModpackFile | null> {
  ensureApiKey();
  const res = await fetch(
    `${CURSEFORGE_API}/v1/mods/${packProjectId}/files/${fileId}`,
    { headers: cfHeaders(), signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS) },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch modpack file ${fileId} (${res.status})`);
  }
  const body = parseCfResponse(
    z.object({ data: rawModpackFileSchema }),
    await res.json(),
    "getModpackFile",
  );
  return toModpackFile(body.data);
}

async function getLatestListedModpackFile(
  packProjectId: number,
): Promise<ModpackFile | null> {
  const res = await fetch(
    `${CURSEFORGE_API}/v1/mods/${packProjectId}/files?pageSize=1`,
    { headers: cfHeaders(), signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch modpack files (${res.status})`);
  }
  const body = parseCfResponse(
    z.object({ data: z.array(rawModpackFileSchema) }),
    await res.json(),
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

const modpackCache = new Map<
  number,
  { manifest: ModpackManifest; fetchedAt: number; ttlMs: number }
>();

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
 * the cache and the backoff and waits out a read that started before the
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

  const cached = modpackCache.get(packProjectId);
  if (!force && cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
    return cached.manifest;
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
    promise: fetchModpackManifest(packProjectId)
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
): Promise<ModpackManifest> {
  ensureApiKey();

  const context = await loadModpackReadContext(packProjectId);
  const listed = await getLatestListedModpackFile(packProjectId);
  const { file, serverPackFileId, complete } = await resolveModpackRelease(
    listed,
    context,
    (fileId) => getModpackFile(packProjectId, fileId),
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
  modpackCache.set(packProjectId, {
    manifest: result,
    fetchedAt: Date.now(),
    ttlMs: complete ? MODPACK_CACHE_TTL : MODPACK_INCOMPLETE_CACHE_TTL,
  });

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
  const dlRes = await fetch(
    `${CURSEFORGE_API}/v1/mods/${packProjectId}/files/${fileId}/download-url`,
    { headers: cfHeaders(), signal: AbortSignal.timeout(CF_FETCH_TIMEOUT_MS) },
  );
  if (!dlRes.ok) {
    throw new Error(
      `Failed to get modpack file ${fileId} download URL (${dlRes.status})`,
    );
  }
  const { data: downloadUrl } = (await dlRes.json()) as { data: string };

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
