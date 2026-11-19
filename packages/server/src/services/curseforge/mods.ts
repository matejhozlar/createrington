import { z } from "zod";
import {
  curseforgeData,
  curseforgeFileIndexSchema,
  curseforgeList,
  curseforgeLogoSchema,
  curseforgeMinecraftVersionSchema,
  curseforgeModSchema,
} from "@createrington/content-gateway-client";
import { compareVersions } from "@/utils/version";
import {
  DEFAULT_GAME_VERSION,
  MINECRAFT_GAME_ID,
  MOD_CLASS_ID,
  MODPACK_PROJECT_ID,
  NEOFORGE_LOADER_TYPE,
  cfRead,
  logoUrlOf,
  postIds,
} from "./client";
import { searchProjects, type CurseForgeProjectHit } from "./content";
import { LOADERLESS_CLASSES } from "./loader";
import { getModpackModIds } from "./modpack-manifest";

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
  modLoaderType?: number | null;
  classId?: number;
  packProjectId?: number | null;
}

export type CurseForgeSearchResult = CurseForgeProjectHit & {
  inModpack: boolean;
};

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

async function loadPackModIds(
  packProjectId: number | null,
): Promise<Set<number>> {
  if (packProjectId === null) return new Set();
  try {
    return await getModpackModIds(packProjectId);
  } catch (error) {
    logger.warn(
      `Modpack manifest fetch failed for pack ${packProjectId}, search results will report inModpack: false`,
      error,
    );
    return new Set();
  }
}

/**
 * First page of `searchProjects` targeting the current server setup unless
 * told otherwise (NeoForge mods for the default game version), each hit
 * annotated with whether the modpack already ships it.
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

  const [{ projects }, packModIds] = await Promise.all([
    searchProjects({
      query,
      classId,
      gameVersion,
      modLoaderType,
      index: 0,
      pageSize,
    }),
    loadPackModIds(packProjectId),
  ]);

  return projects.map((project) => ({
    ...project,
    inModpack: packModIds.has(project.id),
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
  const body = await cfRead(
    "mods/search",
    { query: { gameId: MINECRAFT_GAME_ID, classId, slug } },
    curseforgeList(z.looseObject({ id: z.number(), name: z.string() })),
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

type RawCurseForgeMod = z.infer<typeof curseforgeModSchema>;

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

export function classEnvironmentHint(
  classId: number,
): CurseForgeEnvironmentHint | null {
  return LOADERLESS_CLASSES.has(classId) ? "client" : null;
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
  const body = await cfRead(
    `mods/${projectId}`,
    {},
    curseforgeData(curseforgeModSchema),
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
  });
  return mods.map(mapProject);
}

/** Fetch all released Minecraft versions, newest first (the gateway keeps the list for a day) */
export async function getMinecraftVersions(): Promise<string[]> {
  const body = await cfRead(
    "minecraft/version",
    {},
    curseforgeList(curseforgeMinecraftVersionSchema),
    "getMinecraftVersions",
  );
  return body.data
    .map((entry) => entry.versionString)
    .sort((a, b) => compareVersions(b, a));
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
