import { AppError } from "@/app/middleware/error-handler";
import {
  CURSEFORGE_MINECRAFT_GAME_ID,
  ContentGatewayError,
} from "@createrington/content-gateway-client";
import { ContentGatewayPool, inContentPool } from "@/services/content-gateway";
import {
  CurseForgeLoader,
  LOADERLESS_CLASSES,
  getContentFiles,
  getFileChangelog,
  getMods,
  getProjectDescription,
  listCategories,
  listProjectFiles,
  matchFingerprints,
  resolveFileDownloads,
  searchProjects,
  type CurseForgeFileDownload,
} from "@/services/curseforge";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import {
  LAUNCHER_CONTENT_MAX_RESULTS,
  LauncherContentErrorCode,
  type LauncherContentCategory,
  type LauncherContentFileBatchData,
  type LauncherContentFileDetails,
  type LauncherContentFingerprintMatch,
  type LauncherContentFingerprintsData,
  type LauncherContentLoader,
  type LauncherContentProject,
  type LauncherContentProjectsData,
  type LauncherContentSort,
  type LauncherProjectDetails,
  type LauncherProjectHit,
  type LauncherProjectKind,
} from "@createrington/shared/launcher";
import {
  classForProjectKind,
  describeLauncherProject,
  sortFieldForContentSort,
  toLauncherContentCategory,
  toLauncherContentFileDetails,
  toLauncherContentProject,
  toLauncherProjectDetails,
  toLauncherProjectLatestFiles,
} from "./curseforge-content";

const DOWNLOAD_LOOKUP_TIMEOUT_MS = 15_000;

export interface ContentPage {
  page: number;
  limit: number;
}

export interface ContentSearchFilters {
  categoryIds?: number[];
  sort?: LauncherContentSort;
}

export interface ContentTarget {
  minecraftVersion?: string;
  loader?: LauncherContentLoader;
}

function contentError(
  code: LauncherContentErrorCode,
  statusCode: number,
  message: string,
  headers?: Record<string, string>,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code, headers });
}

function projectNotFound(): AppError {
  return contentError(
    LauncherContentErrorCode.PROJECT_NOT_FOUND,
    404,
    "CurseForge has no such mod, resource pack, shader or modpack",
  );
}

function fileNotFound(): AppError {
  return contentError(
    LauncherContentErrorCode.FILE_NOT_FOUND,
    404,
    "CurseForge has no such file of a mod, resource pack, shader or modpack",
  );
}

function htmlOrNull(html: string | null): string | null {
  return html?.trim() ? html : null;
}

function withoutLatestFiles({
  latestFiles: _latestFiles,
  ...project
}: LauncherContentProject): LauncherContentProject {
  return project;
}

function loaderTypeFor(
  classId: number,
  loader: LauncherContentLoader | undefined,
): number | null {
  if (!loader || LOADERLESS_CLASSES.has(classId)) return null;
  return CurseForgeLoader[loader];
}

/**
 * Looks CurseForge up for content a launcher player adds to a modpack, and for
 * modpacks that are not ours: search, categories, projects, one project in
 * full, a project's files, files by id with their changelogs and the files
 * behind fingerprints, for any mod, resource pack, shader or modpack of
 * Minecraft, not only what our pack ships. Every call goes through the
 * content gateway, which answers from its cache while the answer is fresh
 * and shares a lookup already running, so the same question from many
 * players is one CurseForge call; nothing is kept here and nothing is
 * written to the database. A file CurseForge blocks is resolved through the
 * gateway as the pack files are: Modrinth's copy of the file, or its built
 * address on CurseForge's CDN while the `launcher_curseforge_cdn` feature
 * flag is on, which is read on every answer; a file no source has is
 * answered as manual. Every call draws from the launcher's pool of the key.
 * Throws `CONTENT_UNAVAILABLE` (503) when CurseForge cannot be asked, with a
 * `Retry-After` header when the gateway refused the call because the budget
 * of the minute is spent or CurseForge is holding the key off after a 429.
 * Singleton.
 */
class LauncherContentService {
  private static instance: LauncherContentService;

  static getInstance(): LauncherContentService {
    if (!LauncherContentService.instance) {
      LauncherContentService.instance = new LauncherContentService();
    }
    return LauncherContentService.instance;
  }

  /** One page of the projects of a kind that match the text, in `categoryIds` when given, most popular first unless `sort` says otherwise. `page` counts from 0; `total` never exceeds what CurseForge lets a search page through. */
  async search(
    params: { query: string; kind: LauncherProjectKind } & ContentTarget &
      ContentSearchFilters &
      ContentPage,
  ): Promise<{ projects: LauncherProjectHit[]; total: number }> {
    const classId = classForProjectKind(params.kind);
    const modLoaderType = loaderTypeFor(classId, params.loader);
    const categoryIds = [...new Set(params.categoryIds)].sort((a, b) => a - b);
    const sortField = sortFieldForContentSort(params.sort ?? "relevance");

    const found = await this.ask("search", () =>
      searchProjects({
        query: params.query,
        classId,
        gameVersion: params.minecraftVersion,
        modLoaderType,
        categoryIds,
        sortField,
        index: params.page * params.limit,
        pageSize: params.limit,
      }),
    );

    const projects = found.projects.flatMap((hit) => {
      const project = toLauncherContentProject(hit);
      return project ? [{ ...project, downloads: hit.downloadCount }] : [];
    });
    return {
      projects,
      total: Math.min(found.total, LAUNCHER_CONTENT_MAX_RESULTS),
    };
  }

  /** The categories a search of this kind can be narrowed to, nested ones with their `parentId`, in CurseForge's order. */
  async listCategories(
    kind: LauncherProjectKind,
  ): Promise<LauncherContentCategory[]> {
    const classId = classForProjectKind(kind);
    const categories = await this.ask("categories", async () => {
      const listed = await listCategories(classId);
      if (listed.length === 0) {
        throw new Error(`CurseForge listed no categories of ${kind}`);
      }
      return listed;
    });
    return categories.map((category) =>
      toLauncherContentCategory(category, classId),
    );
  }

  /** The projects with these ids, each with its newest file per Minecraft version and loader. An id CurseForge does not know, or one that is not a mod, resource pack, shader or modpack, comes back in `unknownProjectIds`. */
  async getProjects(
    projectIds: number[],
  ): Promise<LauncherContentProjectsData> {
    const ids = [...new Set(projectIds)];
    const found = await this.loadProjects(ids);

    const projects: LauncherContentProject[] = [];
    const unknownProjectIds: string[] = [];
    for (const id of ids) {
      const project = found.get(id);
      if (project) projects.push(project);
      else unknownProjectIds.push(String(id));
    }
    return { projects, unknownProjectIds };
  }

  /** One project with its description, downloads, categories, links, dates and pictures, the description as CurseForge's HTML. Throws `PROJECT_NOT_FOUND` (404) for a project `getProjects` would not know. */
  async getProjectDetails(projectId: number): Promise<LauncherProjectDetails> {
    const [[data], description] = await this.ask("project details", () =>
      Promise.all([getMods([projectId]), getProjectDescription(projectId)]),
    );
    const details = data
      ? toLauncherProjectDetails(data, htmlOrNull(description))
      : null;
    if (!details) throw projectNotFound();
    return details;
  }

  /** One page of a project's files for a Minecraft version and a loader, in CurseForge's order, blocked files with the address another source has for them. Throws `PROJECT_NOT_FOUND` (404) for a project `getProjects` would not know. */
  async listFiles(
    projectId: number,
    params: ContentTarget & ContentPage,
  ): Promise<{ files: LauncherContentFileDetails[]; total: number }> {
    const project = (await this.loadProjects([projectId])).get(projectId);
    if (!project) throw projectNotFound();

    const modLoaderType = loaderTypeFor(
      classForProjectKind(project.kind),
      params.loader,
    );
    const listed = await this.ask("file list", () =>
      listProjectFiles(projectId, {
        gameVersion: params.minecraftVersion,
        modLoaderType,
        index: params.page * params.limit,
        pageSize: params.limit,
      }),
    );
    const files = listed.files.flatMap((file) => {
      const details = toLauncherContentFileDetails(file, project.url);
      return details ? [details] : [];
    });
    return {
      files: await this.withDownloads(files),
      total: Math.min(listed.total, LAUNCHER_CONTENT_MAX_RESULTS),
    };
  }

  /** One file with its address, hash and dependencies, a blocked file with the address another source has for it. Throws `FILE_NOT_FOUND` (404) when CurseForge does not know it, publishes no SHA-1 for it, or it belongs to no mod, resource pack, shader or modpack of Minecraft. */
  async getFile(fileId: number): Promise<LauncherContentFileDetails> {
    const [file] = await this.withDownloads([await this.loadFile(fileId)]);
    return file;
  }

  /** The files with these ids as `getFile` answers each, in the order asked, in one lookup. An id `getFile` would answer 404 for comes back in `unknownFileIds`. */
  async getFiles(fileIds: number[]): Promise<LauncherContentFileBatchData> {
    const ids = [...new Set(fileIds)];
    const found = await this.loadFiles(ids);

    const known: LauncherContentFileDetails[] = [];
    const unknownFileIds: string[] = [];
    for (const id of ids) {
      const file = found.get(id);
      if (file) known.push(file);
      else unknownFileIds.push(String(id));
    }
    return { files: await this.withDownloads(known), unknownFileIds };
  }

  /** What changed in one file, as CurseForge's HTML, or null when the file has no changelog. Without `projectId` the file is looked up as `getFile` does, and throws `FILE_NOT_FOUND` (404) as it does. A caller that knows the file's project names it in `projectId`, which saves that lookup: then `FILE_NOT_FOUND` is for a project that is no mod, resource pack, shader or modpack and for a file that is no file of it, and the file is not held to the other rules of `getFile` (a name, a size, a SHA-1). */
  async getFileChangelog(
    fileId: number,
    projectId?: number,
  ): Promise<string | null> {
    const ownerId = await this.projectOfFile(fileId, projectId);
    const changelog = await this.ask("changelog", () =>
      getFileChangelog(ownerId, fileId),
    );
    if (changelog === null) throw fileNotFound();
    return htmlOrNull(changelog);
  }

  /** Which project and file each CurseForge fingerprint is, in the order asked. A fingerprint CurseForge does not know, or whose file `getFile` would not answer, comes back in `unmatchedFingerprints`. */
  async identifyFingerprints(
    fingerprints: number[],
  ): Promise<LauncherContentFingerprintsData> {
    const asked = [...new Set(fingerprints)];
    const found =
      asked.length > 0
        ? await this.ask("fingerprint", () => matchFingerprints(asked))
        : [];
    const projects = await this.loadProjects([
      ...new Set(found.map(({ file }) => file.projectId)),
    ]);

    const identified = new Map<number, LauncherContentFileDetails>();
    for (const { fingerprint, file } of found) {
      if (identified.has(fingerprint)) continue;
      const project = projects.get(file.projectId);
      if (!project) continue;
      const details = toLauncherContentFileDetails(file, project.url);
      if (details) identified.set(fingerprint, details);
    }

    const matches: LauncherContentFingerprintMatch[] = [];
    const unmatchedFingerprints: number[] = [];
    for (const fingerprint of asked) {
      const file = identified.get(fingerprint);
      const project = file ? projects.get(Number(file.projectId)) : null;
      if (file && project) {
        matches.push({
          fingerprint,
          project: withoutLatestFiles(project),
          file,
        });
      } else unmatchedFingerprints.push(fingerprint);
    }
    return { matches, unmatchedFingerprints };
  }

  private async loadFile(fileId: number): Promise<LauncherContentFileDetails> {
    const file = (await this.loadFiles([fileId])).get(fileId);
    if (!file) throw fileNotFound();
    return file;
  }

  private async loadFiles(
    fileIds: number[],
  ): Promise<Map<number, LauncherContentFileDetails | null>> {
    const fetched = await this.ask("file", () => getContentFiles(fileIds));
    const byId = new Map(
      fetched
        .filter((file) => file.gameId === CURSEFORGE_MINECRAFT_GAME_ID)
        .map((file) => [file.id, file]),
    );
    const projects = await this.loadProjects([
      ...new Set([...byId.values()].map((file) => file.projectId)),
    ]);

    return new Map(
      fileIds.map((id) => {
        const file = byId.get(id);
        const project = file ? projects.get(file.projectId) : null;
        return [
          id,
          file && project
            ? toLauncherContentFileDetails(file, project.url)
            : null,
        ];
      }),
    );
  }

  private async loadProjects(
    projectIds: number[],
  ): Promise<Map<number, LauncherContentProject | null>> {
    if (projectIds.length === 0) return new Map();
    const fetched = await this.ask("projects", () => getMods(projectIds));
    const byId = new Map(fetched.map((data) => [data.id, data]));

    return new Map(
      projectIds.map((id) => {
        const data = byId.get(id);
        const described = data ? describeLauncherProject(data) : null;
        return [
          id,
          data && described
            ? {
                ...described,
                latestFiles: toLauncherProjectLatestFiles(
                  data.latestFilesIndexes,
                ),
              }
            : null,
        ];
      }),
    );
  }

  private async withDownloads(
    files: LauncherContentFileDetails[],
  ): Promise<LauncherContentFileDetails[]> {
    const blocked = files.filter((file) => file.download.url === null);
    if (blocked.length === 0) return files;

    const cdn = await featureFlagService.isEnabled(
      FeatureFlags.launcherCurseforgeCdn,
    );
    let resolved: Map<number, CurseForgeFileDownload>;
    try {
      resolved = await inContentPool(ContentGatewayPool.launcher, () =>
        resolveFileDownloads(
          blocked.map((file) => Number(file.id)),
          { cdn, timeoutMs: DOWNLOAD_LOOKUP_TIMEOUT_MS },
        ),
      );
    } catch (error) {
      logger.warn("Launcher content download lookup failed:", error);
      return files;
    }

    return files.map((file) => {
      const found = resolved.get(Number(file.id));
      return found?.source && found.url
        ? { ...file, download: { servedBy: found.source, url: found.url } }
        : file;
    });
  }

  private async projectOfFile(
    fileId: number,
    namedProjectId: number | undefined,
  ): Promise<number> {
    if (namedProjectId === undefined) {
      return Number((await this.loadFile(fileId)).projectId);
    }
    const project = (await this.loadProjects([namedProjectId])).get(
      namedProjectId,
    );
    if (!project) throw fileNotFound();
    return namedProjectId;
  }

  private async ask<T>(what: string, call: () => Promise<T>): Promise<T> {
    try {
      return await inContentPool(ContentGatewayPool.launcher, call);
    } catch (error) {
      if (error instanceof ContentGatewayError && error.retryAfterMs !== null) {
        throw contentError(
          LauncherContentErrorCode.CONTENT_UNAVAILABLE,
          503,
          error.message,
          {
            "Retry-After": `${Math.max(1, Math.ceil(error.retryAfterMs / 1000))}`,
          },
        );
      }
      logger.warn(
        `Launcher content ${what} lookup on CurseForge failed:`,
        error,
      );
      throw contentError(
        LauncherContentErrorCode.CONTENT_UNAVAILABLE,
        503,
        "CurseForge cannot be asked right now",
      );
    }
  }
}

export const launcherContentService = LauncherContentService.getInstance();
