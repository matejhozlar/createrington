import type { AppError } from "@/app/middleware/error-handler";
import { Q } from "@/db";
import type { CurseforgeFileWithProject } from "@/db/queries/curseforge/file";
import { CURSEFORGE_MINECRAFT_GAME_ID } from "@createrington/content-gateway-client";
import { getFilesDetails } from "@/services/curseforge/files";
import { resolveFileDownloads } from "@/services/curseforge/downloads";
import { ingestProjectsWhere } from "@/services/curseforge/ingest";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import {
  toLauncherContentFile,
  toLauncherProject,
} from "@/services/launcher/content/curseforge-content";
import {
  LauncherPackErrorCode,
  type LauncherPackFile,
  type LauncherPackFileSource,
  type LauncherPackFilesData,
} from "@createrington/shared/launcher";
import { packError } from "./pack-error";
import { packFolderForClass, pickFileSource } from "./pack-rules";
import {
  findSandboxFileUrls,
  openSandboxFile,
  SandboxUnavailableError,
  storageFileUrl,
  type SandboxDownload,
} from "./sandbox-files";

export interface StorageDownload extends SandboxDownload {
  fileName: string;
}

const MANUAL_RECHECK_MS = 60 * 60 * 1000;
const CDN_RECHECK_MS = 24 * 60 * 60 * 1000;
const RECHECKED_SOURCES: LauncherPackFileSource[] = [
  "manual",
  "curseforge-cdn",
];
const RECHECK_BATCH_SIZE = 50;

export const NOTICE_MAX_FILES = 15;

function fileNotFound(): AppError {
  return packError(
    LauncherPackErrorCode.FILE_NOT_FOUND,
    404,
    "No pack file is served under this id",
  );
}

function toPackFile(row: CurseforgeFileWithProject): LauncherPackFile | null {
  const folder = packFolderForClass(row.project.classId);
  const file = toLauncherContentFile(row);
  const project = toLauncherProject(row.project);
  if (!folder || !file || !project) return null;
  return {
    projectId: row.curseforgeProjectId,
    fileId: row.id,
    fileName: row.fileName,
    size: row.fileSize,
    sha1: row.sha1,
    folder,
    source: row.source,
    url: row.source === "storage" ? storageFileUrl(row.id) : row.downloadUrl,
    pageUrl: file.pageUrl,
    file,
    project,
  };
}

/**
 * Where the launcher downloads each file of a pack manifest from, and the
 * SHA-1 to verify it against. Files are resolved once and stored (the link
 * CurseForge gives, else what the content gateway resolves for a blocked
 * file: a byte-identical file on Modrinth, else the file's built address on
 * CurseForge's CDN when it answers; else a verified copy the sandbox keeps,
 * else manual), so requests read the database. A blocked file the gateway
 * could not ask every source about is not stored and the lookup fails, so it
 * is asked again next time. The built address is unofficial and only used
 * while the `launcher_curseforge_cdn` feature flag is on; once the flag is
 * off, a file stored with it turns manual and is resolved again. While the
 * flag cannot be read, no address is built and stored ones are left as they
 * are. A manual file is looked up again once an hour and a built address once
 * a day by `recheckStaleFiles`, which the file refresh service runs on a
 * schedule, so a player's request only reads; both are looked up again
 * whenever a release is prepared. Also streams the jars and snapshot zips the
 * sandbox keeps.
 */
export class LauncherPackFileService {
  /**
   * Download facts for CurseForge file ids from a pack manifest, each with the
   * project it belongs to for display, answered from the stored rows: a stored
   * file is served as stored, however old, and only `recheckStaleFiles` looks
   * its source up again. Ids not stored yet are resolved and stored first;
   * throws `FILE_SOURCES_UNAVAILABLE` (503) when that lookup fails. Ids that
   * cannot be served (unknown to CurseForge, no SHA-1, not a mod, resource
   * pack or shader) come back in `unresolvedFileIds`.
   */
  async resolveFiles(fileIds: number[]): Promise<LauncherPackFilesData> {
    const ids = [...new Set(fileIds)];
    let stored: Map<number, CurseforgeFileWithProject>;
    try {
      stored = await this.ensureResolved(ids, { recheckStored: false });
    } catch (error) {
      logger.warn("Launcher pack file resolution failed:", error);
      throw packError(
        LauncherPackErrorCode.FILE_SOURCES_UNAVAILABLE,
        503,
        "Pack files cannot be resolved right now",
      );
    }

    const files: LauncherPackFile[] = [];
    const unresolvedFileIds: number[] = [];
    for (const id of ids) {
      const row = stored.get(id);
      const file = row ? toPackFile(row) : null;
      if (file) files.push(file);
      else unresolvedFileIds.push(id);
    }
    return { files, unresolvedFileIds };
  }

  /**
   * Opens a jar the sandbox keeps under this CurseForge file id for streaming
   * to the launcher, with its name and size. Throws `FILE_NOT_FOUND` (404)
   * when no stored file is served from storage under the id or the sandbox
   * no longer keeps it, and `FILE_UNAVAILABLE` (502) when the sandbox cannot
   * serve it. Aborting `signal` cancels the download.
   */
  async openStorageFile(
    fileId: number,
    signal: AbortSignal,
  ): Promise<StorageDownload> {
    const [row] = await Q.curseforge.file.findAll(
      { id: fileId, source: "storage" },
      { limit: 1 },
    );
    if (!row) throw fileNotFound();
    return this.openFromSandbox(
      String(fileId),
      row.fileName,
      row.fileSize,
      signal,
    );
  }

  /**
   * Opens the pack zip of a readied test snapshot for streaming to the
   * launcher, with its name and size. Throws `FILE_NOT_FOUND` (404) when no
   * enabled sandbox pack has a ready release under the snapshot id or the
   * sandbox no longer keeps the zip, and `FILE_UNAVAILABLE` (502) when the
   * sandbox cannot serve it. Aborting `signal` cancels the download.
   */
  async openStorageSnapshot(
    snapshotId: number,
    signal: AbortSignal,
  ): Promise<StorageDownload> {
    const packs = await Q.launcher.pack.findAll({
      source: "sandbox",
      enabled: true,
    });
    const [release] =
      packs.length === 0
        ? []
        : await Q.modpack.release.findAll(
            {
              modpackId: { $in: packs.map((pack) => pack.modpackId) },
              curseforgeFileId: snapshotId,
              launcherReadyAt: { $ne: null },
            },
            { limit: 1 },
          );
    if (!release?.packFileName || release.packFileSize === null) {
      throw fileNotFound();
    }
    return this.openFromSandbox(
      `snapshot/${snapshotId}`,
      release.packFileName,
      release.packFileSize,
      signal,
    );
  }

  private async openFromSandbox(
    path: string,
    fileName: string,
    size: number,
    signal: AbortSignal,
  ): Promise<StorageDownload> {
    let download: SandboxDownload | null;
    try {
      download = await openSandboxFile(path, size, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof SandboxUnavailableError) {
        logger.warn(`Storage file ${path} cannot be served: ${error.message}`);
        throw packError(
          LauncherPackErrorCode.FILE_UNAVAILABLE,
          502,
          "The file cannot be served right now",
        );
      }
      throw error;
    }
    if (!download) throw fileNotFound();
    return { ...download, fileName };
  }

  /**
   * Looks stored files up again whose source can change: manual files
   * resolved more than an hour ago and built CDN addresses resolved more than
   * a day ago, or every built address once that source is switched off.
   * Works through every due file in batches of 50, the files of offered
   * releases first; each batch is marked resolved before its lookup, so a
   * lookup that fails is not repeated before those files are due again.
   * Returns how many files were looked up. Throws when CurseForge cannot be
   * asked.
   */
  async recheckStaleFiles(): Promise<number> {
    const cdnFlag = await this.readCdnFlag();
    const now = Date.now();
    const due = {
      manualBefore: new Date(now - MANUAL_RECHECK_MS),
      cdnBefore:
        cdnFlag === null
          ? null
          : new Date(cdnFlag ? now - CDN_RECHECK_MS : now),
    };
    let total = 0;
    for (;;) {
      const ids = await Q.curseforge.file.getDueIds(due, RECHECK_BATCH_SIZE);
      if (ids.length > 0) await this.recheckStored(ids, cdnFlag);
      total += ids.length;
      if (ids.length < RECHECK_BATCH_SIZE) return total;
    }
  }

  /** Stored rows for these file ids, resolving the ones not stored yet; `recheckStored` looks manual and built-CDN rows up again first. Throws when a source cannot be asked. */
  async ensureResolved(
    fileIds: number[],
    options: { recheckStored: boolean },
  ): Promise<Map<number, CurseforgeFileWithProject>> {
    const ids = [...new Set(fileIds)];
    const stored = await this.loadStored(ids);
    const cdnFlag = await this.readCdnFlag();

    const missing = ids.filter((id) => !stored.has(id));
    if (missing.length > 0) {
      await this.resolveFromSources(missing, cdnFlag === true);
    }

    const stale = options.recheckStored
      ? [...stored.values()]
          .filter(
            (row) =>
              row.source === "manual" ||
              (row.source === "curseforge-cdn" && cdnFlag !== null),
          )
          .map((row) => row.id)
      : [];
    if (stale.length > 0) await this.recheckStored(stale, cdnFlag);

    const rows =
      missing.length > 0 || stale.length > 0
        ? await this.loadStored(ids)
        : stored;
    if (cdnFlag !== false) return rows;
    return new Map(
      [...rows].map(([id, row]) => [
        id,
        row.source === "curseforge-cdn"
          ? { ...row, source: "manual", downloadUrl: null }
          : row,
      ]),
    );
  }

  private async recheckStored(
    fileIds: number[],
    cdnFlag: boolean | null,
  ): Promise<void> {
    if (cdnFlag === false) {
      await Q.curseforge.file.updateAll(
        { source: "manual", downloadUrl: null },
        { id: { $in: fileIds }, source: "curseforge-cdn" },
      );
    }
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date() },
      { id: { $in: fileIds }, source: { $in: RECHECKED_SOURCES } },
    );
    await this.resolveFromSources(fileIds, cdnFlag === true);
  }

  private readCdnFlag(): Promise<boolean | null> {
    return featureFlagService.readEnabled(FeatureFlags.launcherCurseforgeCdn);
  }

  private async loadStored(
    fileIds: number[],
  ): Promise<Map<number, CurseforgeFileWithProject>> {
    const rows = await Q.curseforge.file.getWithProject(fileIds);
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async resolveFromSources(
    fileIds: number[],
    useCdn: boolean,
  ): Promise<void> {
    const details = (await getFilesDetails(fileIds)).flatMap((detail) =>
      detail.gameId === CURSEFORGE_MINECRAFT_GAME_ID &&
      detail.fileName !== null &&
      detail.fileLength !== null &&
      detail.sha1 !== null
        ? [
            {
              fileId: detail.fileId,
              projectId: detail.projectId,
              fileName: detail.fileName,
              fileLength: detail.fileLength,
              sha1: detail.sha1,
              downloadUrl: detail.downloadUrl,
            },
          ]
        : [],
    );
    if (details.length === 0) return;

    const classes = await this.loadProjectClasses([
      ...new Set(details.map((detail) => detail.projectId)),
    ]);
    const servable = details.filter((detail) => {
      const classId = classes.get(detail.projectId);
      return classId !== undefined && packFolderForClass(classId) !== null;
    });
    if (servable.length === 0) return;

    const blocked = servable.filter((detail) => detail.downloadUrl === null);
    const resolved = await resolveFileDownloads(
      blocked.map((detail) => detail.fileId),
      { cdn: useCdn },
    );

    const unsourced = blocked.filter(
      (detail) => !resolved.get(detail.fileId)?.source,
    );
    const pending = new Set(
      unsourced
        .filter((detail) => resolved.get(detail.fileId)?.retry)
        .map((detail) => detail.fileId),
    );
    const sandbox = await findSandboxFileUrls(
      unsourced
        .filter((detail) => !pending.has(detail.fileId))
        .map((detail) => ({
          fileId: detail.fileId,
          sha1: detail.sha1,
          size: detail.fileLength,
        })),
    );

    await Q.curseforge.file.upsertMany(
      servable
        .filter((detail) => !pending.has(detail.fileId))
        .map((detail) => ({
          id: detail.fileId,
          curseforgeProjectId: detail.projectId,
          fileName: detail.fileName,
          fileSize: detail.fileLength,
          sha1: detail.sha1,
          ...pickFileSource({
            curseforge: detail.downloadUrl,
            resolved: resolved.get(detail.fileId) ?? null,
            storage: sandbox.get(detail.fileId) ?? null,
          }),
        })),
    );

    if (pending.size > 0) {
      throw new Error(
        `${pending.size} file(s) could not be resolved because a source could not be asked (file ids ${[...pending].slice(0, NOTICE_MAX_FILES).join(", ")})`,
      );
    }
  }

  private async loadProjectClasses(
    projectIds: number[],
  ): Promise<Map<number, number>> {
    const read = () =>
      Q.curseforge.project.findAll(
        { id: { $in: projectIds } },
        { select: ["id", "classId"] },
      );
    let rows = await read();
    const cached = new Set(rows.map((row) => row.id));
    const missing = projectIds.filter((id) => !cached.has(id));
    if (missing.length > 0) {
      const added = await ingestProjectsWhere(
        missing,
        (project) => packFolderForClass(project.classId) !== null,
      );
      if (added > 0) rows = await read();
    }
    return new Map(rows.map((row) => [row.id, row.classId]));
  }
}

export const launcherPackFileService = new LauncherPackFileService();
