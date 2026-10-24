import {
  AppError,
  BadRequestError,
  ConflictError,
} from "@/app/middleware/error-handler";
import config from "@/config";
import { db, Q } from "@/db";
import { UniqueViolationError } from "@/db/utils";
import type { CurseforgeFileWithProject } from "@/db/queries/curseforge/file";
import type {
  ChangelogEntry,
  ChangelogInput,
} from "@/discord/components/presets/modpack-changelog";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import {
  CURSEFORGE_MINECRAFT_GAME_ID,
  getFilesDetails,
  getModpackFile,
  getServedFileIds,
  type ModpackManifest,
} from "@/services/curseforge";
import {
  ingestProjectsWhere,
  refreshProjects,
} from "@/services/curseforge/ingest";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import {
  curseforgeFilePageUrl,
  toLauncherContentFile,
  toLauncherPackProject,
  toLauncherProject,
} from "@/services/launcher/content/curseforge-content";
import { getReleaseChangelog } from "@/services/modpack/release-changelog";
import { settings } from "@/services/settings";
import { findModrinthFilesBySha1 } from "@/services/modrinth";
import { getMinecraftJavaMajorVersion } from "@/utils/mojang-java-version";
import type {
  LauncherPack,
  LauncherPackSource,
  Modpack,
  ModpackRelease,
} from "@createrington/shared/db";
import {
  LAUNCHER_APP_SOURCE,
  LAUNCHER_MODPACK_KIND,
  LauncherPackErrorCode,
  type LauncherPackChangelog,
  type LauncherPackChangelogEntry,
  type LauncherPackData,
  type LauncherPackFile,
  type LauncherPackFileSource,
  type LauncherPackFilesData,
  type LauncherPackProject,
  type LauncherPackRelease,
  type LauncherPackSummary,
} from "@createrington/shared/launcher";
import { findCurseforgeCdnUrls } from "./curseforge-cdn";
import {
  packFolderForClass,
  parseModLoader,
  pickFileSource,
} from "./pack-rules";
import {
  findSandboxFileUrls,
  openSandboxFile,
  SandboxUnavailableError,
  storageFileUrl,
  storageSnapshotUrl,
  type SandboxDownload,
} from "./sandbox-files";

export interface SnapshotZip {
  fileName: string;
  size: number;
  sha1: string;
  downloadUrl: string;
}

export interface SnapshotEntry {
  projectId: number;
  fileId: number;
  required: boolean;
}

export type SnapshotOutcome =
  | { status: "ready" }
  | { status: "busy" }
  | { status: "blocked"; reason: string };

export interface StorageDownload extends SandboxDownload {
  fileName: string;
}

function toAppProject(slug: string, modpack: Modpack): LauncherPackProject {
  return {
    source: LAUNCHER_APP_SOURCE,
    id: String(modpack.id),
    slug,
    kind: LAUNCHER_MODPACK_KIND,
    name: modpack.name,
    summary: modpack.description,
    author: null,
    iconUrl: modpack.iconUrl,
    url: config.meta.links.website ?? APP_PROJECT_FALLBACK_URL,
  };
}

const ZIP_SERVED_BY: Record<LauncherPackSource, LauncherPackFileSource> = {
  curseforge: "curseforge",
  sandbox: "storage",
};
const MANUAL_RECHECK_MS = 60 * 60 * 1000;
const CDN_RECHECK_MS = 24 * 60 * 60 * 1000;
const RECHECKED_SOURCES: LauncherPackFileSource[] = [
  "manual",
  "curseforge-cdn",
];
const RECHECK_BATCH_SIZE = 50;
const NOTICE_MAX_FILES = 15;
const PROJECT_LOOKUP_RETRY_MS = 60 * 1000;
const DEFAULT_PACK_SLUG = "createrington";
const RELEASE_NEXT_STEP =
  "Fix the release or publish a new one, then check the published pack again.";
const SNAPSHOT_NEXT_STEP =
  "Fix the cause and report the snapshot again, or restart the test server.";
const APP_PROJECT_FALLBACK_URL = "https://createrington.com";
const PACK_ORDER = { orderBy: "position", orderDirection: "asc" } as const;
const SLUG_CONSTRAINT = "uq_launcher_pack_slug";
const MODPACK_CONSTRAINT = "uq_launcher_pack_modpack";

export interface OwnedLauncherPack extends LauncherPack {
  modpack: Pick<Modpack, "id" | "name" | "curseforgeProjectId" | "serverId">;
  latestVersion: string | null;
}

export type LauncherPackCandidate = Pick<
  Modpack,
  "id" | "name" | "curseforgeProjectId" | "serverId"
>;

function packError(
  code: LauncherPackErrorCode,
  statusCode: number,
  message: string,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code });
}

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

function toPackData(
  release: ModpackRelease,
  project: LauncherPackProject,
  source: LauncherPackSource,
): LauncherPackData | null {
  const modLoader = release.modLoader
    ? parseModLoader(release.modLoader)
    : null;
  if (
    !release.version ||
    !release.minecraftVersion ||
    !modLoader ||
    release.javaMajorVersion === null ||
    !release.packFileName ||
    release.packFileSize === null ||
    !release.packSha1 ||
    !release.packDownloadUrl
  ) {
    return null;
  }

  return {
    project,
    version: release.version,
    releasedAt: release.publishedAt?.toISOString() ?? null,
    minecraftVersion: release.minecraftVersion,
    modLoader,
    javaMajorVersion: release.javaMajorVersion,
    zip: {
      fileId: release.curseforgeFileId,
      fileName: release.packFileName,
      url:
        source === "sandbox"
          ? storageSnapshotUrl(release.curseforgeFileId)
          : release.packDownloadUrl,
      size: release.packFileSize,
      sha1: release.packSha1,
      servedBy: ZIP_SERVED_BY[source],
    },
  };
}

function toChangelogEntry(entry: ChangelogEntry): LauncherPackChangelogEntry {
  return {
    projectId: entry.projectId,
    name: entry.name,
    url: entry.url,
    iconUrl: entry.thumbnailUrl,
    label: entry.label,
    previousLabel: entry.previousLabel,
    disabled: entry.disabled,
  };
}

function toPackChangelog(changelog: ChangelogInput): LauncherPackChangelog {
  return {
    previousVersion: changelog.previousVersion,
    added: changelog.added.map(toChangelogEntry),
    updated: changelog.updated.map(toChangelogEntry),
    removed: changelog.removed.map(toChangelogEntry),
    notes: changelog.notes,
  };
}

/**
 * Serves the launcher what it needs to install the modpacks the owner offers
 * it: which packs there are, which release of each is the latest, which
 * releases can still be installed and what each of them changed, and for the
 * file ids in a pack manifest, where to download each file and the SHA-1 to
 * verify it against. A pack is a `launcher_pack` row the owner manages, keyed
 * by the slug the launcher stores; the first row is seeded once at startup for
 * the modpack linked to `CURSEFORGE_MODPACK_PROJECT_ID`, so a deploy needs no
 * setup step, and a table the owner emptied afterwards stays empty. A pack
 * whose releases come from CurseForge is described by its CurseForge project:
 * its name, icon, summary and page as CurseForge publishes them, read from the
 * stored project and never from the app's own modpack fields. A pack whose
 * project is not stored is asked for on CurseForge (at most once a minute) and
 * is not served until it is. A pack whose releases come from the sandbox is
 * described by its modpack row instead (name, description, icon), and its
 * releases are the snapshots `prepareSnapshot` readied, the newest one only.
 * Files are resolved once and stored (the link CurseForge gives, else a
 * byte-identical file on Modrinth, else the file's built address on
 * CurseForge's CDN when it answers, else a verified copy the sandbox keeps,
 * else manual), so requests read the database. The built address is unofficial and only used while the
 * `launcher_curseforge_cdn` feature flag is on; once the flag is off, a file
 * stored with it turns manual and is resolved again. While the flag cannot be
 * read, no address is built and stored ones are left as they are. A manual
 * file is looked up again once an hour and a built address once a day by
 * `recheckStaleFiles`, which the file refresh service runs on a schedule, so a
 * player's request only reads; both are looked up again whenever a release is
 * prepared. A release is offered as latest only
 * after `prepareRelease` stored its pack zip, Java version and every client
 * file. Singleton.
 */
class LauncherPackService {
  private static instance: LauncherPackService;

  private readonly preparing = new Set<number>();
  private readonly checking = new Set<number>();
  private readonly reportedBlocked = new Set<number>();
  private readonly projectLookups = new Map<
    number,
    { lookup: Promise<void>; startedAt: number }
  >();

  static getInstance(): LauncherPackService {
    if (!LauncherPackService.instance) {
      LauncherPackService.instance = new LauncherPackService();
    }
    return LauncherPackService.instance;
  }

  /**
   * Offers the modpack linked to `CURSEFORGE_MODPACK_PROJECT_ID` to the
   * launcher as the `createrington` pack, once: the first time a pack is
   * stored, by this seed or by the owner, that is recorded, and from then on
   * the table is the owner's, empty or not. No-op while no modpack carries
   * that project, so the seed happens on a later start once one does.
   */
  async seedDefaultPack(): Promise<void> {
    if (await settings.getLauncherPacksSeeded()) return;
    if ((await Q.launcher.pack.count()) > 0) {
      await settings.markLauncherPacksSeeded();
      return;
    }
    const modpack = await Q.modpack.find({
      curseforgeProjectId: config.curseforge.modpackProjectId,
    });
    if (!modpack) return;

    await Q.launcher.pack.create({
      slug: DEFAULT_PACK_SLUG,
      modpackId: modpack.id,
      source: "curseforge",
    });
    await settings.markLauncherPacksSeeded();
    logger.info(
      `Offering ${modpack.name} to the launcher as the "${DEFAULT_PACK_SLUG}" pack`,
    );
  }

  /** Every pack row in the owner's order, enabled or not, with the modpack it points at and the version of its newest ready release. */
  async listOwned(): Promise<OwnedLauncherPack[]> {
    const packs = await Q.launcher.pack.findAll({}, PACK_ORDER);
    if (packs.length === 0) return [];
    const modpacks = await Q.modpack.findAll(
      { id: { $in: packs.map((pack) => pack.modpackId) } },
      { select: ["id", "name", "curseforgeProjectId", "serverId"] },
    );
    const modpackById = new Map(modpacks.map((row) => [row.id, row]));
    return Promise.all(
      packs.map(async (pack) => {
        const modpack = modpackById.get(pack.modpackId);
        if (!modpack) {
          throw new Error(
            `Launcher pack "${pack.slug}" points at modpack #${pack.modpackId}, which does not exist`,
          );
        }
        const release = await this.findLatestRelease(pack.modpackId);
        return { ...pack, modpack, latestVersion: release?.version ?? null };
      }),
    );
  }

  /** The modpacks no pack row points at yet, by name, for the owner to pick from. */
  async listCandidates(): Promise<LauncherPackCandidate[]> {
    const [modpacks, packs] = await Promise.all([
      Q.modpack.findAll(
        {},
        {
          select: ["id", "name", "curseforgeProjectId", "serverId"],
          orderBy: "name",
          orderDirection: "asc",
        },
      ),
      Q.launcher.pack.findAll({}, { select: ["modpackId"] }),
    ]);
    const offered = new Set(packs.map((pack) => pack.modpackId));
    return modpacks.filter((modpack) => !offered.has(modpack.id));
  }

  /**
   * Offers a modpack to the launcher under a new slug, last in the list.
   * Throws `NotFoundError` for an unknown modpack, `BadRequestError` when a
   * pack served from CurseForge has no CurseForge project linked, and
   * `ConflictError` when the slug is taken or the modpack is already offered.
   * Records that a pack was stored, so the startup seed stays quiet from now
   * on.
   */
  async addPack(input: {
    slug: string;
    modpackId: number;
    source: LauncherPackSource;
  }): Promise<LauncherPack> {
    const modpack = await Q.modpack.get({ id: input.modpackId });
    if (input.source === "curseforge" && modpack.curseforgeProjectId === null) {
      throw new BadRequestError(
        `"${modpack.name}" has no CurseForge project linked, so its releases cannot come from CurseForge`,
      );
    }

    const [last] = await Q.launcher.pack.findAll(
      {},
      { orderBy: "position", orderDirection: "desc", limit: 1 },
    );
    let pack: LauncherPack;
    try {
      pack = await Q.launcher.pack.createAndReturn({
        slug: input.slug,
        modpackId: modpack.id,
        source: input.source,
        position: last ? last.position + 1 : 0,
      });
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        if (error.constraint === SLUG_CONSTRAINT) {
          throw new ConflictError(
            `The launcher already offers a pack as "${input.slug}"`,
          );
        }
        if (error.constraint === MODPACK_CONSTRAINT) {
          throw new ConflictError(
            `The launcher already offers "${modpack.name}"`,
          );
        }
      }
      throw error;
    }
    await settings.markLauncherPacksSeeded();
    logger.info(
      `Offering ${modpack.name} to the launcher as the "${pack.slug}" pack (${pack.source})`,
    );
    return pack;
  }

  /** Shows or hides a pack in the launcher's list. Its releases keep being prepared either way. Throws `NotFoundError` for an unknown pack. */
  async setPackEnabled(id: number, enabled: boolean): Promise<LauncherPack> {
    return Q.launcher.pack.updateAndReturn(
      { id },
      { enabled, updatedAt: new Date() },
    );
  }

  /**
   * Puts the packs in the given order, first id first. Throws
   * `BadRequestError` unless the ids are exactly the stored packs, each once.
   */
  async reorderPacks(ids: number[]): Promise<LauncherPack[]> {
    const packs = await Q.launcher.pack.findAll({}, PACK_ORDER);
    const stored = new Set(packs.map((pack) => pack.id));
    const wanted = new Set(ids);
    if (
      ids.length !== packs.length ||
      wanted.size !== ids.length ||
      ids.some((id) => !stored.has(id))
    ) {
      throw new BadRequestError(
        "The new order has to name every launcher pack exactly once",
      );
    }

    const now = new Date();
    await db.inTransaction(async (tx) => {
      for (const [position, id] of ids.entries()) {
        await tx.launcher.pack.updateAll({ position, updatedAt: now }, { id });
      }
    });
    return Q.launcher.pack.findAll({}, PACK_ORDER);
  }

  /** Stops offering a pack; a launcher that stored its slug gets `PACK_NOT_FOUND` from then on. Throws `NotFoundError` for an unknown pack. */
  async removePack(id: number): Promise<LauncherPack> {
    const pack = await Q.launcher.pack.get({ id });
    await Q.launcher.pack.delete({ id });
    logger.info(`No longer offering the "${pack.slug}" pack to the launcher`);
    return pack;
  }

  /**
   * Every enabled pack in the owner's order, each described for the pack list
   * (name, summary, icon, the server it belongs to) with its newest ready
   * release, or `latest: null` while it has none. A pack served from
   * CurseForge takes its description from its project, and from its modpack
   * row while the project cannot be served.
   */
  async listPacks(): Promise<LauncherPackSummary[]> {
    const packs = await Q.launcher.pack.findAll({ enabled: true }, PACK_ORDER);
    return Promise.all(packs.map((pack) => this.describePack(pack)));
  }

  /** The newest release of the pack that is ready for the launcher, with the project that identifies the pack. Throws `PACK_NOT_FOUND` (404) for a slug no enabled pack carries and `PACK_UNAVAILABLE` (404) when no release is ready or the pack's project cannot be served. */
  async getLatestPack(slug: string): Promise<LauncherPackData> {
    const pack = await this.requirePack(slug);
    const modpack = await Q.modpack.get({ id: pack.modpackId });
    const project = await this.projectFor(pack, modpack);
    const release = project ? await this.findLatestRelease(modpack.id) : null;
    const data =
      release && project ? toPackData(release, project, pack.source) : null;
    if (!data) {
      throw packError(
        LauncherPackErrorCode.PACK_UNAVAILABLE,
        404,
        "No modpack release is available to the launcher yet",
      );
    }
    return data;
  }

  /**
   * Every release of the pack the launcher can install, newest first: ready
   * for the launcher and not found archived on CurseForge by the last
   * `checkReleases`. Each comes with its changelog: the mods it added, updated
   * and removed against the release recorded before it (listed or not), and
   * the publish notes. Paged, `page` counts from 0, with `total` counting
   * every listed release. Reads the database only, unless the pack's project
   * is not stored yet. Throws `PACK_NOT_FOUND` (404) for a slug no enabled
   * pack carries. Empty when there is no release, when the page is past the
   * end, and while the pack's project cannot be served.
   */
  async listReleases(
    slug: string,
    paging: { page: number; limit: number },
  ): Promise<{ releases: LauncherPackRelease[]; total: number }> {
    const { page, limit } = paging;
    const pack = await this.requirePack(slug);
    const modpack = await Q.modpack.get({ id: pack.modpackId });
    const project = await this.projectFor(pack, modpack);
    if (!project) return { releases: [], total: 0 };

    const filters = {
      modpackId: modpack.id,
      launcherReadyAt: { $ne: null },
      launcherUnavailableAt: null,
    };
    const [rows, total] = await Promise.all([
      Q.modpack.release.findAll(filters, {
        orderBy: "id",
        orderDirection: "desc",
        limit,
        offset: page * limit,
      }),
      Q.modpack.release.count(filters),
    ]);
    const releases = await Promise.all(
      rows.map(async (row): Promise<LauncherPackRelease | null> => {
        const data = toPackData(row, project, pack.source);
        if (!data) {
          logger.warn(
            `${modpack.name} release #${row.id} is ready for the launcher but cannot be served: a pack field is missing`,
          );
          return null;
        }
        return {
          ...data,
          changelog: toPackChangelog(await getReleaseChangelog(modpack, row)),
        };
      }),
    );
    return { releases: releases.filter((release) => release !== null), total };
  }

  /**
   * Asks CurseForge again about every release that is ready for the launcher
   * and takes a release out of `listReleases` while its pack zip or one of its
   * client files is archived there, or puts it back once all of them are
   * served again. For a release recorded before the side of its files was
   * stored only the pack zip decides. `getLatestPack` is not affected. Stores
   * the pack's CurseForge project again first, so the name, icon, summary and
   * page the launcher is given follow CurseForge. No-op for a modpack no pack
   * serves from CurseForge and while another call checks the same pack.
   * Throws when CurseForge cannot be asked; no release is changed then.
   */
  async checkReleases(modpack: Modpack): Promise<void> {
    const projectId = modpack.curseforgeProjectId;
    if (
      projectId === null ||
      this.checking.has(modpack.id) ||
      !(await this.servesFromCurseforge(modpack))
    ) {
      return;
    }

    this.checking.add(modpack.id);
    try {
      await refreshProjects([projectId]);

      const releases = await Q.modpack.release.findAll({
        modpackId: modpack.id,
        launcherReadyAt: { $ne: null },
      });
      if (releases.length === 0) return;

      const fileIdsByRelease = new Map(
        releases.map((release) => [release.id, [release.curseforgeFileId]]),
      );
      const clientFiles = await Q.modpack.release.mod.getClientFileIds(
        releases.map((release) => release.id),
      );
      for (const { releaseId, fileId } of clientFiles) {
        fileIdsByRelease.get(releaseId)?.push(fileId);
      }

      const served = await getServedFileIds([
        ...new Set([...fileIdsByRelease.values()].flat()),
      ]);
      const isServed = (release: ModpackRelease) =>
        (fileIdsByRelease.get(release.id) ?? []).every((id) => served.has(id));

      const archived = releases.filter(
        (release) =>
          release.launcherUnavailableAt === null && !isServed(release),
      );
      const restored = releases.filter(
        (release) =>
          release.launcherUnavailableAt !== null && isServed(release),
      );
      if (archived.length > 0) {
        await Q.modpack.release.updateAll(
          { launcherUnavailableAt: new Date() },
          { id: { $in: archived.map((release) => release.id) } },
        );
      }
      if (restored.length > 0) {
        await Q.modpack.release.updateAll(
          { launcherUnavailableAt: null },
          { id: { $in: restored.map((release) => release.id) } },
        );
      }

      const label = (changed: ModpackRelease[]) =>
        changed
          .map((release) => release.version ?? release.curseforgeFileId)
          .join(", ");
      if (archived.length > 0) {
        logger.info(
          `${modpack.name}: CurseForge archived files of ${label(archived)}, no longer listed as installable for the launcher`,
        );
      }
      if (restored.length > 0) {
        logger.info(
          `${modpack.name}: CurseForge serves ${label(restored)} again, listed as installable for the launcher`,
        );
      }
    } finally {
      this.checking.delete(modpack.id);
    }
  }

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
   * Makes a recorded release available to the launcher: resolves every client
   * file of its manifest, stores the pack zip's link and hash and the Java
   * version, then marks it ready. Posts to the admin notifications channel when
   * a client file ends up manual, or when the release cannot be made ready.
   * No-op for a modpack no pack serves from CurseForge, for a release that is
   * already ready, and while another call prepares the same release. Throws
   * when CurseForge, Modrinth or Mojang cannot be reached; the next reconcile
   * tries again.
   */
  async prepareRelease(
    modpack: Modpack,
    releaseId: number,
    manifest: ModpackManifest,
  ): Promise<void> {
    const projectId = modpack.curseforgeProjectId;
    if (
      projectId === null ||
      this.preparing.has(releaseId) ||
      !(await this.servesFromCurseforge(modpack))
    ) {
      return;
    }

    this.preparing.add(releaseId);
    try {
      const release = await Q.modpack.release.get({ id: releaseId });
      if (release.launcherReadyAt !== null) return;
      if (release.curseforgeFileId !== manifest.fileId) {
        await this.reportBlocked(
          modpack,
          release,
          "it was recorded under the file id of its server pack, so its client pack zip is not known",
        );
        return;
      }

      const modLoader = manifest.modLoader
        ? parseModLoader(manifest.modLoader)
        : null;
      if (!manifest.version || !manifest.minecraftVersion || !modLoader) {
        await this.reportBlocked(
          modpack,
          release,
          "its manifest does not name a pack version, a Minecraft version and a mod loader",
        );
        return;
      }

      const clientEntries = manifest.entries.filter(
        (entry) => entry.sides !== "server",
      );
      const stored = await this.ensureResolved(
        clientEntries.map((entry) => entry.fileId),
        { recheckStored: true },
      );
      const unresolved = clientEntries.filter((entry) => {
        const row = stored.get(entry.fileId);
        return !row || packFolderForClass(row.project.classId) === null;
      });
      if (unresolved.length > 0) {
        await this.reportBlocked(
          modpack,
          release,
          `${unresolved.length} client file(s) could not be resolved on CurseForge (file ids ${unresolved
            .slice(0, NOTICE_MAX_FILES)
            .map((entry) => entry.fileId)
            .join(", ")})`,
        );
        return;
      }

      const pack = await getModpackFile(projectId, manifest.fileId);
      if (
        !pack?.fileName ||
        !pack.downloadUrl ||
        !pack.sha1 ||
        pack.fileLength === null
      ) {
        await this.reportBlocked(
          modpack,
          release,
          "CurseForge gives no download link or SHA-1 for the pack zip",
        );
        return;
      }

      await this.readyRelease(
        modpack,
        release,
        {
          version: manifest.version,
          minecraftVersion: manifest.minecraftVersion,
          modLoader: modLoader.id,
          zip: {
            fileName: pack.fileName,
            size: pack.fileLength,
            sha1: pack.sha1,
            downloadUrl: pack.downloadUrl,
          },
          clientEntries,
          stored,
        },
        RELEASE_NEXT_STEP,
      );
    } finally {
      this.preparing.delete(releaseId);
    }
  }

  /**
   * Makes a recorded snapshot of a sandbox pack available to the launcher:
   * resolves every client file, stores the zip the sandbox verified and the
   * Java version, marks the release ready and takes every older release of
   * the modpack out of the list of installable releases, so the launcher
   * only ever offers the newest snapshot. Posts to the admin notifications
   * channel when a client file ends up manual or the snapshot cannot be made
   * ready. Answers `ready` for a release that is ready, by this call or
   * before, `busy` while another call prepares it, and `blocked` with the
   * reason the owner was told. Throws when CurseForge, Modrinth or Mojang
   * cannot be reached.
   */
  async prepareSnapshot(
    modpack: Modpack,
    releaseId: number,
    snapshot: {
      version: string;
      minecraftVersion: string;
      modLoader: string;
      zip: SnapshotZip;
      entries: SnapshotEntry[];
    },
  ): Promise<SnapshotOutcome> {
    if (this.preparing.has(releaseId)) return { status: "busy" };

    this.preparing.add(releaseId);
    try {
      const release = await Q.modpack.release.get({ id: releaseId });
      if (release.launcherReadyAt !== null) return { status: "ready" };

      const modLoader = parseModLoader(snapshot.modLoader);
      if (!modLoader) {
        return {
          status: "blocked",
          reason: await this.reportBlocked(
            modpack,
            release,
            `its mod loader "${snapshot.modLoader}" does not name a loader and a version`,
            SNAPSHOT_NEXT_STEP,
          ),
        };
      }

      const stored = await this.ensureResolved(
        snapshot.entries.map((entry) => entry.fileId),
        { recheckStored: true },
      );
      const unresolved = snapshot.entries.filter((entry) => {
        const row = stored.get(entry.fileId);
        return !row || packFolderForClass(row.project.classId) === null;
      });
      if (unresolved.length > 0) {
        return {
          status: "blocked",
          reason: await this.reportBlocked(
            modpack,
            release,
            `${unresolved.length} client file(s) could not be resolved on CurseForge (file ids ${unresolved
              .slice(0, NOTICE_MAX_FILES)
              .map((entry) => entry.fileId)
              .join(", ")})`,
            SNAPSHOT_NEXT_STEP,
          ),
        };
      }

      const blocked = await this.readyRelease(
        modpack,
        release,
        {
          version: snapshot.version,
          minecraftVersion: snapshot.minecraftVersion,
          modLoader: snapshot.modLoader,
          zip: snapshot.zip,
          clientEntries: snapshot.entries,
          stored,
        },
        SNAPSHOT_NEXT_STEP,
      );
      if (blocked !== null) return { status: "blocked", reason: blocked };

      const retired = await Q.modpack.release.updateAll(
        { launcherUnavailableAt: new Date() },
        {
          modpackId: modpack.id,
          id: { $lt: release.id },
          launcherUnavailableAt: null,
        },
      );
      if (retired > 0) {
        logger.info(
          `${modpack.name}: ${retired} older snapshot(s) no longer listed as installable for the launcher`,
        );
      }
      return { status: "ready" };
    } finally {
      this.preparing.delete(releaseId);
    }
  }

  private async readyRelease(
    modpack: Modpack,
    release: ModpackRelease,
    facts: {
      version: string;
      minecraftVersion: string;
      modLoader: string;
      zip: SnapshotZip;
      clientEntries: SnapshotEntry[];
      stored: Map<number, CurseforgeFileWithProject>;
    },
    nextStep: string,
  ): Promise<string | null> {
    const javaMajorVersion = await getMinecraftJavaMajorVersion(
      facts.minecraftVersion,
    );
    if (javaMajorVersion === null) {
      return this.reportBlocked(
        modpack,
        release,
        `Mojang lists no Java version for Minecraft ${facts.minecraftVersion}`,
        nextStep,
      );
    }

    const changed = await Q.modpack.release.updateAll(
      {
        version: facts.version,
        minecraftVersion: facts.minecraftVersion,
        modLoader: facts.modLoader,
        packFileName: facts.zip.fileName,
        packFileSize: facts.zip.size,
        packSha1: facts.zip.sha1,
        packDownloadUrl: facts.zip.downloadUrl,
        javaMajorVersion,
        launcherReadyAt: new Date(),
      },
      { id: release.id, launcherReadyAt: null },
    );
    if (changed === 0) return null;

    this.reportedBlocked.delete(release.id);
    logger.info(
      `Modpack #${modpack.id} release ${facts.version} is ready for the launcher: ${facts.clientEntries.length} client files`,
    );

    const manual = facts.clientEntries.filter(
      (entry) => facts.stored.get(entry.fileId)?.source === "manual",
    );
    if (manual.length > 0) {
      await this.notifyManualFiles(
        modpack,
        facts.version,
        manual,
        facts.stored,
      );
    }
    return null;
  }

  private async requirePack(slug: string): Promise<LauncherPack> {
    const pack = await Q.launcher.pack.find({ slug });
    if (!pack?.enabled) {
      throw packError(
        LauncherPackErrorCode.PACK_NOT_FOUND,
        404,
        "The launcher offers no pack by this name",
      );
    }
    return pack;
  }

  private async servesFromCurseforge(modpack: Modpack): Promise<boolean> {
    const pack = await Q.launcher.pack.find({ modpackId: modpack.id });
    return pack?.source === "curseforge";
  }

  private async findLatestRelease(
    modpackId: number,
  ): Promise<ModpackRelease | null> {
    const [release] = await Q.modpack.release.findAll(
      { modpackId, launcherReadyAt: { $ne: null } },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );
    return release ?? null;
  }

  private async describePack(pack: LauncherPack): Promise<LauncherPackSummary> {
    const modpack = await Q.modpack.get({ id: pack.modpackId });
    const server = modpack.serverId
      ? await Q.server.find(
          { id: modpack.serverId },
          { select: ["id", "name", "identifier"] },
        )
      : null;
    const project = await this.projectFor(pack, modpack);
    const release = project ? await this.findLatestRelease(modpack.id) : null;

    return {
      slug: pack.slug,
      source: pack.source,
      name: project?.name ?? modpack.name,
      summary: project?.summary ?? modpack.description,
      iconUrl: project?.iconUrl ?? null,
      server,
      latest:
        release && project ? toPackData(release, project, pack.source) : null,
    };
  }

  private async projectFor(
    pack: LauncherPack,
    modpack: Modpack,
  ): Promise<LauncherPackProject | null> {
    return pack.source === "curseforge"
      ? this.loadPackProject(modpack)
      : toAppProject(pack.slug, modpack);
  }

  private async loadPackProject(
    modpack: Modpack,
  ): Promise<LauncherPackProject | null> {
    const projectId = modpack.curseforgeProjectId;
    if (projectId === null) return null;

    let row = await Q.curseforge.project.find({ id: projectId });
    if (!row) {
      await this.storePackProject(projectId);
      row = await Q.curseforge.project.find({ id: projectId });
    }
    const project = row ? toLauncherPackProject(row) : null;
    if (!project) {
      logger.warn(
        `${modpack.name} cannot be served to the launcher: CurseForge project #${projectId} is ${row ? "not a modpack" : "not stored"}`,
      );
    }
    return project;
  }

  private storePackProject(projectId: number): Promise<void> {
    const held = this.projectLookups.get(projectId);
    if (held && Date.now() - held.startedAt < PROJECT_LOOKUP_RETRY_MS) {
      return held.lookup;
    }

    const lookup = refreshProjects([projectId]).then(
      () => undefined,
      (error) => {
        logger.warn(
          `CurseForge project #${projectId} of the launcher's pack could not be stored:`,
          error,
        );
      },
    );
    this.projectLookups.set(projectId, { lookup, startedAt: Date.now() });
    return lookup;
  }

  /**
   * Looks stored files up again whose source can change: manual files
   * resolved more than an hour ago and built CDN addresses resolved more than
   * a day ago, or every built address once that source is switched off.
   * Oldest first, at most 50 per call; each is marked resolved before the
   * lookup, so a lookup that fails is not repeated before the file is due
   * again. Returns how many files were looked up. Throws when CurseForge
   * cannot be asked.
   */
  async recheckStaleFiles(): Promise<number> {
    const cdnFlag = await this.readCdnFlag();
    const now = Date.now();
    const ids = await Q.curseforge.file.getDueIds(
      {
        manualBefore: new Date(now - MANUAL_RECHECK_MS),
        cdnBefore:
          cdnFlag === null
            ? null
            : new Date(cdnFlag ? now - CDN_RECHECK_MS : now),
      },
      RECHECK_BATCH_SIZE,
    );
    if (ids.length > 0) await this.recheckStored(ids, cdnFlag);
    return ids.length;
  }

  private async ensureResolved(
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
    const modrinth = await findModrinthFilesBySha1(
      blocked.map((detail) => detail.sha1),
    );

    const notOnModrinth = blocked.filter(
      (detail) => !modrinth.has(detail.sha1),
    );
    const cdn = useCdn
      ? await findCurseforgeCdnUrls(
          notOnModrinth.map((detail) => ({
            fileId: detail.fileId,
            fileName: detail.fileName,
            size: detail.fileLength,
          })),
        )
      : new Map<number, string>();

    const sandbox = await findSandboxFileUrls(
      notOnModrinth
        .filter((detail) => !cdn.has(detail.fileId))
        .map((detail) => ({
          fileId: detail.fileId,
          sha1: detail.sha1,
          size: detail.fileLength,
        })),
    );

    await Q.curseforge.file.upsertMany(
      servable.map((detail) => ({
        id: detail.fileId,
        curseforgeProjectId: detail.projectId,
        fileName: detail.fileName,
        fileSize: detail.fileLength,
        sha1: detail.sha1,
        ...pickFileSource({
          curseforge: detail.downloadUrl,
          modrinth: modrinth.get(detail.sha1)?.url ?? null,
          curseforgeCdn: cdn.get(detail.fileId) ?? null,
          storage: sandbox.get(detail.fileId) ?? null,
        }),
      })),
    );
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

  private async reportBlocked(
    modpack: Modpack,
    release: ModpackRelease,
    reason: string,
    nextStep: string = RELEASE_NEXT_STEP,
  ): Promise<string> {
    const label = `${modpack.name} ${release.version ?? `file ${release.curseforgeFileId}`}`;
    logger.warn(`${label} is not offered to the launcher: ${reason}`);
    if (this.reportedBlocked.has(release.id)) return reason;
    this.reportedBlocked.add(release.id);

    await this.notifyOwner(
      EmbedPresets.plain({
        title: "⛔ Launcher: release not offered",
        description: [
          `**Pack**: ${label}`,
          `The launcher keeps installing the previous release, because ${reason}.`,
          nextStep,
        ].join("\n"),
        color: EmbedColors.Error,
      }),
    );
    return reason;
  }

  private async notifyManualFiles(
    modpack: Modpack,
    version: string,
    manual: SnapshotEntry[],
    stored: Map<number, CurseforgeFileWithProject>,
  ): Promise<void> {
    const projects = await Q.curseforge.project.findAll(
      { id: { $in: [...new Set(manual.map((entry) => entry.projectId))] } },
      { select: ["id", "name"] },
    );
    const nameById = new Map(projects.map((row) => [row.id, row.name]));

    const lines = manual.slice(0, NOTICE_MAX_FILES).map((entry) => {
      const row = stored.get(entry.fileId);
      const name = nameById.get(entry.projectId) ?? `#${entry.projectId}`;
      const pageUrl = row ? curseforgeFilePageUrl(row.project, row.id) : null;
      return [
        `- ${pageUrl ? `[${name}](${pageUrl})` : name}`,
        row ? `\`${row.fileName}\`` : "",
        entry.required ? "" : "(ships disabled)",
      ]
        .filter(Boolean)
        .join(" ");
    });
    if (manual.length > NOTICE_MAX_FILES) {
      lines.push(`- and ${manual.length - NOTICE_MAX_FILES} more`);
    }

    await this.notifyOwner(
      EmbedPresets.plain({
        title: "⚠️ Launcher: files without a download source",
        description: [
          `**Pack**: ${modpack.name} ${version}`,
          "CurseForge gives no download link for these client files, Modrinth has no identical copy, their built address on CurseForge's CDN is switched off or does not answer, and the sandbox keeps none, so launcher players are asked to download them in the browser:",
          ...lines,
        ].join("\n"),
        color: EmbedColors.Warning,
      }),
    );
  }

  private async notifyOwner(
    embed: ReturnType<typeof EmbedPresets.plain>,
  ): Promise<void> {
    const ownerId = config.app.auth.owner.discordId;
    try {
      await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        content: `<@${ownerId}>`,
        embeds: embed.build(),
        allowedMentions: { users: [ownerId] },
      });
    } catch (error) {
      logger.error("Failed to post the launcher pack notice:", error);
    }
  }
}

export const launcherPackService = LauncherPackService.getInstance();
