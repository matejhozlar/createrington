import { AppError } from "@/app/middleware/error-handler";
import {
  CURSEFORGE_BATCH_SIZE,
  CURSEFORGE_MINECRAFT_GAME_ID,
  CurseForgeLoader,
  LOADERLESS_CLASSES,
  getContentFiles,
  getFileChangelog,
  getMods,
  getProjectDescription,
  listCategories,
  listProjectFiles,
  matchFingerprints,
  searchProjects,
} from "@/services/curseforge";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import {
  keyValueStore,
  readStored,
  readThrough,
  writeStored,
} from "@/services/key-value-store";
import { resolveCurseforgeCdnUrls } from "@/services/launcher/pack/curseforge-cdn";
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

const SEARCH_TTL_MS = 5 * 60_000;
const CATEGORIES_TTL_MS = 24 * 60 * 60_000;
const PROJECT_TTL_MS = 60 * 60_000;
const UNKNOWN_PROJECT_TTL_MS = 5 * 60_000;
const FILES_TTL_MS = 10 * 60_000;
const CHANGELOG_TTL_MS = 24 * 60 * 60_000;
const FINGERPRINT_TTL_MS = 60 * 60_000;
const UNKNOWN_FINGERPRINT_TTL_MS = 10 * 60_000;
const CDN_URL_TTL_MS = 60 * 60_000;
const UNKNOWN_CDN_URL_TTL_MS = 10 * 60_000;
const CDN_LOOKUP_BUDGET_MS = 5_000;
const KEY_PREFIX = "launcher:content:curseforge:v1";

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
): AppError {
  return new AppError(message, statusCode, true, undefined, { code });
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
 * Minecraft, not only what our pack ships. Answers come from the key-value
 * store while they are fresh (a search for 5 minutes, a project or a known
 * fingerprint for an hour, files and unknown fingerprints for 10 minutes,
 * categories and a changelog for a day), so the same question from many
 * players is one CurseForge call, and a lookup already running is shared.
 * Projects and files are fetched in batches of 100 that are kept and shared
 * one by one, so a batch that fails costs only itself on the next call.
 * Nothing is written to the database. A file CurseForge blocks is answered as
 * manual, except by `listFiles`, `getFile` and `getFiles` while the
 * `launcher_curseforge_cdn` feature flag is on: they answer the file's built
 * address on CurseForge's CDN when it answers there with the right size
 * (remembered for an hour, a miss for 10 minutes, a file the CDN gave no
 * answer for not at all), and the flag is read on every answer, so switching
 * it takes effect at once. The other sources the pack service has for blocked
 * files are for our pack only. Throws `CONTENT_UNAVAILABLE` (503) when
 * CurseForge cannot be asked. Singleton.
 */
class LauncherContentService {
  private static instance: LauncherContentService;

  private readonly loadingProjects = new Map<
    number,
    Promise<LauncherContentProject | null>
  >();

  private readonly loadingFiles = new Map<
    number,
    Promise<LauncherContentFileDetails | null>
  >();

  private readonly resolvingCdnUrls = new Map<string, Promise<string | null>>();

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
    const key = `${KEY_PREFIX}:search:${JSON.stringify([
      params.query.toLowerCase(),
      params.kind,
      params.minecraftVersion ?? null,
      modLoaderType,
      params.page,
      params.limit,
      categoryIds,
      sortField,
    ])}`;

    return readThrough(keyValueStore, key, SEARCH_TTL_MS, async () => {
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
    });
  }

  /** The categories a search of this kind can be narrowed to, nested ones with their `parentId`, in CurseForge's order. */
  async listCategories(
    kind: LauncherProjectKind,
  ): Promise<LauncherContentCategory[]> {
    const classId = classForProjectKind(kind);
    return readThrough(
      keyValueStore,
      `${KEY_PREFIX}:categories:${classId}`,
      CATEGORIES_TTL_MS,
      async () => {
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
      },
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
    const details = await readThrough(
      keyValueStore,
      this.projectDetailsKey(projectId),
      (found) => (found ? PROJECT_TTL_MS : UNKNOWN_PROJECT_TTL_MS),
      async () => {
        const [[data], description] = await this.ask("project details", () =>
          Promise.all([getMods([projectId]), getProjectDescription(projectId)]),
        );
        return data
          ? toLauncherProjectDetails(data, htmlOrNull(description))
          : null;
      },
    );

    if (!details) throw projectNotFound();
    return details;
  }

  /** One page of a project's files for a Minecraft version and a loader, in CurseForge's order, blocked files with their CDN address while the flag is on. Throws `PROJECT_NOT_FOUND` (404) for a project `getProjects` would not know. */
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
    const key = `${KEY_PREFIX}:files:${JSON.stringify([
      projectId,
      params.minecraftVersion ?? null,
      modLoaderType,
      params.page,
      params.limit,
    ])}`;

    const page = await readThrough(
      keyValueStore,
      key,
      FILES_TTL_MS,
      async () => {
        const listed = await this.ask("file list", () =>
          listProjectFiles(projectId, {
            gameVersion: params.minecraftVersion,
            modLoaderType,
            index: params.page * params.limit,
            pageSize: params.limit,
          }),
        );
        return {
          files: listed.files.flatMap((file) => {
            const details = toLauncherContentFileDetails(file, project.url);
            return details ? [details] : [];
          }),
          total: Math.min(listed.total, LAUNCHER_CONTENT_MAX_RESULTS),
        };
      },
    );
    return { ...page, files: await this.withCdnDownloads(page.files) };
  }

  /** One file with its address, hash and dependencies, a blocked file with its CDN address while the flag is on. Throws `FILE_NOT_FOUND` (404) when CurseForge does not know it, publishes no SHA-1 for it, or it belongs to no mod, resource pack, shader or modpack of Minecraft. */
  async getFile(fileId: number): Promise<LauncherContentFileDetails> {
    const [file] = await this.withCdnDownloads([await this.loadFile(fileId)]);
    return file;
  }

  /** The files with these ids as `getFile` answers each, in the order asked, with one CurseForge call per 100 files it has not just looked up. An id `getFile` would answer 404 for comes back in `unknownFileIds`. */
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
    return { files: await this.withCdnDownloads(known), unknownFileIds };
  }

  /** What changed in one file, as CurseForge's HTML, or null when the file has no changelog. Without `projectId` the file is looked up as `getFile` does, and throws `FILE_NOT_FOUND` (404) as it does. A caller that knows the file's project names it in `projectId`, which saves that lookup: then `FILE_NOT_FOUND` is for a project that is no mod, resource pack, shader or modpack and for a file that is no file of it, and the file is not held to the other rules of `getFile` (a name, a size, a SHA-1). A changelog kept from an earlier call is answered either way. */
  async getFileChangelog(
    fileId: number,
    projectId?: number,
  ): Promise<string | null> {
    return readThrough(
      keyValueStore,
      this.changelogKey(fileId),
      CHANGELOG_TTL_MS,
      async () => {
        const ownerId = await this.projectOfFile(fileId, projectId);
        const changelog = await this.ask("changelog", () =>
          getFileChangelog(ownerId, fileId),
        );
        if (changelog === null) throw fileNotFound();
        return htmlOrNull(changelog);
      },
    );
  }

  /** Which project and file each CurseForge fingerprint is, in the order asked. A fingerprint CurseForge does not know, or whose file `getFile` would not answer, comes back in `unmatchedFingerprints`. */
  async identifyFingerprints(
    fingerprints: number[],
  ): Promise<LauncherContentFingerprintsData> {
    const asked = [...new Set(fingerprints)];
    const stored = await Promise.all(
      asked.map((fingerprint) =>
        readStored<LauncherContentFileDetails | null>(
          keyValueStore,
          this.fingerprintKey(fingerprint),
        ),
      ),
    );

    const files = new Map<number, LauncherContentFileDetails | null>();
    const missing: number[] = [];
    asked.forEach((fingerprint, index) => {
      const file = stored[index];
      if (file !== undefined) files.set(fingerprint, file);
      else missing.push(fingerprint);
    });

    const found =
      missing.length > 0
        ? await this.ask("fingerprint", () => matchFingerprints(missing))
        : [];
    const projects = await this.loadProjects([
      ...new Set([
        ...[...files.values()].flatMap((file) =>
          file ? [Number(file.projectId)] : [],
        ),
        ...found.map(({ file }) => file.projectId),
      ]),
    ]);

    const identified = new Map<number, LauncherContentFileDetails | null>(
      missing.map((fingerprint) => [fingerprint, null]),
    );
    for (const { fingerprint, file } of found) {
      if (identified.get(fingerprint) !== null) continue;
      const project = projects.get(file.projectId);
      if (!project) continue;
      identified.set(
        fingerprint,
        toLauncherContentFileDetails(file, project.url),
      );
    }
    await Promise.all(
      [...identified].flatMap(([fingerprint, file]) => [
        writeStored(
          keyValueStore,
          this.fingerprintKey(fingerprint),
          file,
          file ? FINGERPRINT_TTL_MS : UNKNOWN_FINGERPRINT_TTL_MS,
        ),
        ...(file
          ? [
              writeStored(
                keyValueStore,
                this.fileKey(Number(file.id)),
                file,
                FILES_TTL_MS,
              ),
            ]
          : []),
      ]),
    );

    const matches: LauncherContentFingerprintMatch[] = [];
    const unmatchedFingerprints: number[] = [];
    for (const fingerprint of asked) {
      const file = files.get(fingerprint) ?? identified.get(fingerprint);
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

  private loadFiles(
    fileIds: number[],
  ): Promise<Map<number, LauncherContentFileDetails | null>> {
    return this.loadShared(
      fileIds,
      (id) => this.fileKey(id),
      this.loadingFiles,
      (missing) => this.fetchFiles(missing),
      CURSEFORGE_BATCH_SIZE,
    );
  }

  private async fetchFiles(
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

    const files = new Map<number, LauncherContentFileDetails | null>();
    await Promise.all(
      fileIds.map((id) => {
        const file = byId.get(id);
        const project = file ? projects.get(file.projectId) : null;
        const details =
          file && project
            ? toLauncherContentFileDetails(file, project.url)
            : null;
        files.set(id, details);
        return writeStored(
          keyValueStore,
          this.fileKey(id),
          details,
          FILES_TTL_MS,
        );
      }),
    );
    return files;
  }

  private async withCdnDownloads(
    files: LauncherContentFileDetails[],
  ): Promise<LauncherContentFileDetails[]> {
    const blocked = files.filter((file) => file.download.url === null);
    if (blocked.length === 0) return files;

    const useCdn = await featureFlagService.isEnabled(
      FeatureFlags.launcherCurseforgeCdn,
    );
    if (!useCdn) return files;

    const blockedById = new Map(blocked.map((file) => [file.id, file]));
    const urls = await this.loadShared(
      [...blockedById.keys()],
      (id) => this.cdnUrlKey(id),
      this.resolvingCdnUrls,
      (missing) =>
        this.resolveCdnUrls(missing.flatMap((id) => blockedById.get(id) ?? [])),
    );

    return files.map((file) => {
      const url = urls.get(file.id);
      return url
        ? { ...file, download: { servedBy: "curseforge-cdn", url } }
        : file;
    });
  }

  private async resolveCdnUrls(
    files: LauncherContentFileDetails[],
  ): Promise<Map<string, string | null>> {
    const resolved = await resolveCurseforgeCdnUrls(
      files.map((file) => ({
        fileId: Number(file.id),
        fileName: file.fileName,
        size: file.size,
      })),
      CDN_LOOKUP_BUDGET_MS,
    );

    const urls = new Map<string, string | null>();
    await Promise.all(
      [...resolved].map(([fileId, url]) => {
        urls.set(String(fileId), url);
        return writeStored(
          keyValueStore,
          this.cdnUrlKey(String(fileId)),
          url,
          url ? CDN_URL_TTL_MS : UNKNOWN_CDN_URL_TTL_MS,
        );
      }),
    );
    return urls;
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

  private loadProjects(
    projectIds: number[],
  ): Promise<Map<number, LauncherContentProject | null>> {
    return this.loadShared(
      projectIds,
      (id) => this.projectKey(id),
      this.loadingProjects,
      (missing) => this.fetchProjects(missing),
      CURSEFORGE_BATCH_SIZE,
    );
  }

  private async loadShared<Id, Value>(
    ids: Id[],
    keyOf: (id: Id) => string,
    loading: Map<Id, Promise<Value | null>>,
    fetch: (missing: Id[]) => Promise<Map<Id, Value | null>>,
    batchSize = Infinity,
  ): Promise<Map<Id, Value | null>> {
    const stored = await Promise.all(
      ids.map((id) => readStored<Value | null>(keyValueStore, keyOf(id))),
    );

    const found = new Map<Id, Value | null>();
    const waiting: Array<[Id, Promise<Value | null>]> = [];
    const missing: Id[] = [];
    ids.forEach((id, index) => {
      const value = stored[index];
      const pending = loading.get(id);
      if (value !== undefined) found.set(id, value);
      else if (pending) waiting.push([id, pending]);
      else missing.push(id);
    });

    for (let start = 0; start < missing.length; start += batchSize) {
      const batch = missing.slice(start, start + batchSize);
      const fetched = fetch(batch);
      for (const id of batch) {
        const pending = fetched.then((values) => values.get(id) ?? null);
        loading.set(id, pending);
        waiting.push([id, pending]);
      }
      const done = () => {
        for (const id of batch) loading.delete(id);
      };
      fetched.then(done, done);
    }

    const loaded = await Promise.all(waiting.map(([, pending]) => pending));
    waiting.forEach(([id], index) => found.set(id, loaded[index] ?? null));
    return found;
  }

  private async fetchProjects(
    projectIds: number[],
  ): Promise<Map<number, LauncherContentProject | null>> {
    const fetched = await this.ask("projects", () => getMods(projectIds));
    const byId = new Map(fetched.map((data) => [data.id, data]));

    const projects = new Map<number, LauncherContentProject | null>();
    for (const id of projectIds) {
      const data = byId.get(id);
      const described = data ? describeLauncherProject(data) : null;
      const project =
        data && described
          ? {
              ...described,
              latestFiles: toLauncherProjectLatestFiles(
                data.latestFilesIndexes,
              ),
            }
          : null;
      projects.set(id, project);
      await writeStored(
        keyValueStore,
        this.projectKey(id),
        project,
        project ? PROJECT_TTL_MS : UNKNOWN_PROJECT_TTL_MS,
      );
    }
    return projects;
  }

  private projectKey(projectId: number): string {
    return `${KEY_PREFIX}:project:${projectId}`;
  }

  private projectDetailsKey(projectId: number): string {
    return `${KEY_PREFIX}:project-details:${projectId}`;
  }

  private fileKey(fileId: number): string {
    return `${KEY_PREFIX}:file:${fileId}`;
  }

  private cdnUrlKey(fileId: string): string {
    return `${KEY_PREFIX}:cdn-url:${fileId}`;
  }

  private changelogKey(fileId: number): string {
    return `${KEY_PREFIX}:changelog:${fileId}`;
  }

  private fingerprintKey(fingerprint: number): string {
    return `${KEY_PREFIX}:fingerprint:${fingerprint}`;
  }

  private async ask<T>(what: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
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
