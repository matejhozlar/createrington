import { z } from "zod";
import {
  curseforgeCategorySchema,
  curseforgeData,
  curseforgeFileSchema,
  curseforgeFingerprintMatchesSchema,
  curseforgeList,
  curseforgePage,
} from "@createrington/content-gateway-client";
import {
  CurseForgeSortField,
  MINECRAFT_GAME_ID,
  cfRead,
  logoUrlOf,
  searchHitSchema,
  toCurseForgeFile,
  type CurseForgeFile,
} from "./client";

export interface CurseForgePage {
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

/**
 * One page of the Minecraft projects of a class that match the text, with the
 * number of matches CurseForge counts in total: most popular first, or highest
 * first by `sortField`. An empty text lists the class, and `categoryIds`
 * narrows it to those categories. No game version or loader is assumed.
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
  const body = await cfRead(
    "mods/search",
    {
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
    },
    curseforgePage(searchHitSchema),
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
  const body = await cfRead(
    "categories",
    { query: { gameId: MINECRAFT_GAME_ID, classId } },
    curseforgeList(curseforgeCategorySchema),
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
 * number of files that match in total. No game version or loader is
 * assumed.
 */
export async function listProjectFiles(
  projectId: number,
  options: {
    gameVersion?: string;
    modLoaderType?: number | null;
  } & CurseForgePage,
): Promise<{ files: CurseForgeFile[]; total: number }> {
  const body = await cfRead(
    `mods/${projectId}/files`,
    {
      query: {
        index: options.index,
        pageSize: options.pageSize,
        gameVersion: options.gameVersion || undefined,
        modLoaderType: options.modLoaderType,
      },
    },
    curseforgePage(curseforgeFileSchema),
    "listProjectFiles",
  );

  return {
    files: body.data.map(toCurseForgeFile),
    total: body.pagination.totalCount,
  };
}

async function getHtml(path: string, endpoint: string): Promise<string | null> {
  const body = await cfRead(
    path,
    {},
    curseforgeData(z.string().nullish()),
    endpoint,
    { notFound: "null" },
  );
  return body === null ? null : (body.data ?? "");
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
  file: CurseForgeFile;
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
  const body = await cfRead(
    `fingerprints/${MINECRAFT_GAME_ID}`,
    { body: { fingerprints } },
    curseforgeData(curseforgeFingerprintMatchesSchema),
    "matchFingerprints",
  );

  return (body.data.exactMatches ?? []).map(({ file }) => ({
    fingerprint: file.fileFingerprint,
    file: toCurseForgeFile(file),
  }));
}
