import { z } from "zod";
import {
  CurseForgeRelationType,
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
  answerText,
  cfFetch,
  isDependency,
  logoUrlOf,
  parseCfResponse,
  postIds,
  searchHitSchema,
  sha1Of,
  type RawFile,
} from "./client";

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
