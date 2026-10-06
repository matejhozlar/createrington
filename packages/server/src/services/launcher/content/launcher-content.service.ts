import { AppError } from "@/app/middleware/error-handler";
import {
  CURSEFORGE_MINECRAFT_GAME_ID,
  CurseForgeLoader,
  LOADERLESS_CLASSES,
  getContentFiles,
  getMods,
  listProjectFiles,
  matchFingerprints,
  searchProjects,
} from "@/services/curseforge";
import {
  keyValueStore,
  readStored,
  readThrough,
  writeStored,
} from "@/services/key-value-store";
import {
  LAUNCHER_CONTENT_MAX_RESULTS,
  LauncherContentErrorCode,
  type LauncherContentFileDetails,
  type LauncherContentFingerprintMatch,
  type LauncherContentFingerprintsData,
  type LauncherContentKind,
  type LauncherContentLoader,
  type LauncherContentProjectsData,
  type LauncherProject,
  type LauncherProjectHit,
} from "@createrington/shared/launcher";
import {
  classForContentKind,
  toLauncherContentFileDetails,
  toLauncherProject,
} from "./curseforge-content";

const SEARCH_TTL_MS = 5 * 60_000;
const PROJECT_TTL_MS = 60 * 60_000;
const UNKNOWN_PROJECT_TTL_MS = 5 * 60_000;
const FILES_TTL_MS = 10 * 60_000;
const FINGERPRINT_TTL_MS = 60 * 60_000;
const UNKNOWN_FINGERPRINT_TTL_MS = 10 * 60_000;
const KEY_PREFIX = "launcher:content:curseforge:v1";

export interface ContentPage {
  page: number;
  limit: number;
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

function loaderTypeFor(
  classId: number,
  loader: LauncherContentLoader | undefined,
): number | null {
  if (!loader || LOADERLESS_CLASSES.has(classId)) return null;
  return CurseForgeLoader[loader];
}

/**
 * Looks CurseForge up for content a launcher player adds to a modpack: search,
 * projects, a project's files, single files and the files behind fingerprints,
 * for any mod, resource pack or shader of Minecraft, not only what our pack
 * ships. Answers come from the key-value store while they are fresh (a search
 * for 5 minutes, a project or a known fingerprint for an hour, files and
 * unknown fingerprints for 10 minutes), so the same question from many players
 * is one CurseForge call. Nothing is written to the database, and a file
 * CurseForge blocks is answered as manual: the other sources the pack service
 * has for blocked files are for our pack only. Throws `CONTENT_UNAVAILABLE`
 * (503) when CurseForge cannot be asked. Singleton.
 */
class LauncherContentService {
  private static instance: LauncherContentService;

  private readonly loadingProjects = new Map<
    number,
    Promise<LauncherProject | null>
  >();

  static getInstance(): LauncherContentService {
    if (!LauncherContentService.instance) {
      LauncherContentService.instance = new LauncherContentService();
    }
    return LauncherContentService.instance;
  }

  /** One page of the projects of a kind that match the text, most popular first. `page` counts from 0; `total` never exceeds what CurseForge lets a search page through. */
  async search(
    params: { query: string; kind: LauncherContentKind } & ContentTarget &
      ContentPage,
  ): Promise<{ projects: LauncherProjectHit[]; total: number }> {
    const classId = classForContentKind(params.kind);
    const modLoaderType = loaderTypeFor(classId, params.loader);
    const key = `${KEY_PREFIX}:search:${JSON.stringify([
      params.query.toLowerCase(),
      params.kind,
      params.minecraftVersion ?? null,
      modLoaderType,
      params.page,
      params.limit,
    ])}`;

    return readThrough(keyValueStore, key, SEARCH_TTL_MS, async () => {
      const found = await this.ask("search", () =>
        searchProjects({
          query: params.query,
          classId,
          gameVersion: params.minecraftVersion,
          modLoaderType,
          index: params.page * params.limit,
          pageSize: params.limit,
        }),
      );

      const projects = found.projects.flatMap((hit) => {
        const project = toLauncherProject(hit);
        return project ? [{ ...project, downloads: hit.downloadCount }] : [];
      });
      return {
        projects,
        total: Math.min(found.total, LAUNCHER_CONTENT_MAX_RESULTS),
      };
    });
  }

  /** The projects with these ids. An id CurseForge does not know, or one that is not a mod, resource pack or shader, comes back in `unknownProjectIds`. */
  async getProjects(
    projectIds: number[],
  ): Promise<LauncherContentProjectsData> {
    const ids = [...new Set(projectIds)];
    const found = await this.loadProjects(ids);

    const projects: LauncherProject[] = [];
    const unknownProjectIds: string[] = [];
    for (const id of ids) {
      const project = found.get(id);
      if (project) projects.push(project);
      else unknownProjectIds.push(String(id));
    }
    return { projects, unknownProjectIds };
  }

  /** One page of a project's files for a Minecraft version and a loader, in CurseForge's order. Throws `PROJECT_NOT_FOUND` (404) for a project `getProjects` would not know. */
  async listFiles(
    projectId: number,
    params: ContentTarget & ContentPage,
  ): Promise<{ files: LauncherContentFileDetails[]; total: number }> {
    const project = (await this.loadProjects([projectId])).get(projectId);
    if (!project) {
      throw contentError(
        LauncherContentErrorCode.PROJECT_NOT_FOUND,
        404,
        "CurseForge has no such mod, resource pack or shader",
      );
    }

    const modLoaderType = loaderTypeFor(
      classForContentKind(project.kind),
      params.loader,
    );
    const key = `${KEY_PREFIX}:files:${JSON.stringify([
      projectId,
      params.minecraftVersion ?? null,
      modLoaderType,
      params.page,
      params.limit,
    ])}`;

    return readThrough(keyValueStore, key, FILES_TTL_MS, async () => {
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
    });
  }

  /** One file with its address, hash and dependencies. Throws `FILE_NOT_FOUND` (404) when CurseForge does not know it, publishes no SHA-1 for it, or it belongs to no mod, resource pack or shader of Minecraft. */
  async getFile(fileId: number): Promise<LauncherContentFileDetails> {
    const file = await readThrough(
      keyValueStore,
      this.fileKey(fileId),
      FILES_TTL_MS,
      async () => {
        const [found] = await this.ask("file", () => getContentFiles([fileId]));
        if (!found || found.gameId !== CURSEFORGE_MINECRAFT_GAME_ID) {
          return null;
        }
        const project = (await this.loadProjects([found.projectId])).get(
          found.projectId,
        );
        return project
          ? toLauncherContentFileDetails(found, project.url)
          : null;
      },
    );

    if (!file) {
      throw contentError(
        LauncherContentErrorCode.FILE_NOT_FOUND,
        404,
        "CurseForge has no such file of a mod, resource pack or shader",
      );
    }
    return file;
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
      if (file && project) matches.push({ fingerprint, project, file });
      else unmatchedFingerprints.push(fingerprint);
    }
    return { matches, unmatchedFingerprints };
  }

  private async loadProjects(
    projectIds: number[],
  ): Promise<Map<number, LauncherProject | null>> {
    const stored = await Promise.all(
      projectIds.map((id) =>
        readStored<LauncherProject | null>(keyValueStore, this.projectKey(id)),
      ),
    );

    const projects = new Map<number, LauncherProject | null>();
    const waiting: Array<[number, Promise<LauncherProject | null>]> = [];
    const missing: number[] = [];
    projectIds.forEach((id, index) => {
      const project = stored[index];
      const loading = this.loadingProjects.get(id);
      if (project !== undefined) projects.set(id, project);
      else if (loading) waiting.push([id, loading]);
      else missing.push(id);
    });

    if (missing.length > 0) {
      const fetched = this.fetchProjects(missing);
      for (const id of missing) {
        const loading = fetched.then((found) => found.get(id) ?? null);
        this.loadingProjects.set(id, loading);
        waiting.push([id, loading]);
      }
      const done = () => {
        for (const id of missing) this.loadingProjects.delete(id);
      };
      fetched.then(done, done);
    }

    const loaded = await Promise.all(waiting.map(([, loading]) => loading));
    waiting.forEach(([id], index) => projects.set(id, loaded[index] ?? null));
    return projects;
  }

  private async fetchProjects(
    projectIds: number[],
  ): Promise<Map<number, LauncherProject | null>> {
    const fetched = await this.ask("projects", () => getMods(projectIds));
    const byId = new Map(fetched.map((data) => [data.id, data]));

    const projects = new Map<number, LauncherProject | null>();
    for (const id of projectIds) {
      const data = byId.get(id);
      const project = data
        ? toLauncherProject({
            id: data.id,
            classId: data.classId,
            slug: data.slug,
            name: data.name,
            summary: data.summary || null,
            thumbnailUrl: data.thumbnailUrl,
            websiteUrl: data.websiteUrl,
            primaryAuthor: data.authors[0]?.name ?? null,
          })
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

  private fileKey(fileId: number): string {
    return `${KEY_PREFIX}:file:${fileId}`;
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
