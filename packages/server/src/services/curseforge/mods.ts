import { z } from "zod";
import {
  curseforgeData,
  curseforgeFileIndexSchema,
  curseforgeFileSchema,
  curseforgeList,
  curseforgeLogoSchema,
  curseforgeMinecraftVersionSchema,
  curseforgeModSchema,
} from "@createrington/content-gateway-client";
import {
  CurseForgeClass,
  CurseForgeSortField,
  DEFAULT_GAME_VERSION,
  MINECRAFT_GAME_ID,
  MOD_CLASS_ID,
  MODPACK_PROJECT_ID,
  NEOFORGE_LOADER_TYPE,
  answerText,
  cfFetch,
  isDependency,
  logoUrlOf,
  parseCfResponse,
  postIds,
  searchHitSchema,
} from "./client";
import { getModpackModIds } from "./modpack-manifest";

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
