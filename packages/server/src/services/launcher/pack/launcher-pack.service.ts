import { AppError } from "@/app/middleware/error-handler";
import config from "@/config";
import { Q } from "@/db";
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
  type ModpackManifestEntry,
} from "@/services/curseforge";
import { ingestProjectsWhere } from "@/services/curseforge/ingest";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import { getReleaseChangelog } from "@/services/modpack/release-changelog";
import { findModrinthFilesBySha1 } from "@/services/modrinth";
import { getMinecraftJavaMajorVersion } from "@/utils/mojang-java-version";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import {
  LauncherPackErrorCode,
  type LauncherPackChangelog,
  type LauncherPackChangelogEntry,
  type LauncherPackData,
  type LauncherPackFile,
  type LauncherPackFileSource,
  type LauncherPackFilesData,
  type LauncherPackRelease,
} from "@createrington/shared/launcher";
import { findCurseforgeCdnUrls } from "./curseforge-cdn";
import {
  curseforgeFilePageUrl,
  packFolderForClass,
  parseModLoader,
  pickFileSource,
} from "./pack-rules";
import { findSandboxFileUrls } from "./sandbox-files";

const MANUAL_RECHECK_MS = 60 * 60 * 1000;
const CDN_RECHECK_MS = 24 * 60 * 60 * 1000;
const RECHECKED_SOURCES: LauncherPackFileSource[] = [
  "manual",
  "curseforge-cdn",
];
const NOTICE_MAX_FILES = 15;

function packError(
  code: LauncherPackErrorCode,
  statusCode: number,
  message: string,
): AppError {
  return new AppError(message, statusCode, true, undefined, { code });
}

function toPackFile(row: CurseforgeFileWithProject): LauncherPackFile | null {
  const folder = packFolderForClass(row.classId);
  const pageUrl = curseforgeFilePageUrl(row, row.id);
  if (!folder || !pageUrl) return null;
  return {
    projectId: row.curseforgeProjectId,
    fileId: row.id,
    fileName: row.fileName,
    size: row.fileSize,
    sha1: row.sha1,
    folder,
    source: row.source,
    url: row.downloadUrl,
    pageUrl,
  };
}

function toPackData(release: ModpackRelease): LauncherPackData | null {
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
    version: release.version,
    releasedAt: release.publishedAt?.toISOString() ?? null,
    minecraftVersion: release.minecraftVersion,
    modLoader,
    javaMajorVersion: release.javaMajorVersion,
    zip: {
      fileId: release.curseforgeFileId,
      fileName: release.packFileName,
      url: release.packDownloadUrl,
      size: release.packFileSize,
      sha1: release.packSha1,
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
 * Serves the launcher what it needs to install the modpack from its CurseForge
 * pack zip: which release is the latest, which releases can still be
 * installed and what each of them changed, and for the file ids in a pack
 * manifest, where to download each file and the SHA-1 to verify it against.
 * Only the pack linked to `CURSEFORGE_MODPACK_PROJECT_ID` is served. Files are
 * resolved once and stored (the link CurseForge gives, else a byte-identical
 * file on Modrinth, else the file's built address on CurseForge's CDN when it
 * answers, else a verified copy the sandbox keeps, else manual), so requests
 * read the database. The built address is unofficial and only used while the
 * `launcher_curseforge_cdn` feature flag is on; once the flag is off, a file
 * stored with it turns manual and is resolved again. While the flag cannot be
 * read, no address is built and stored ones are left as they are. A manual
 * file is looked up again at most once an hour, a built address once a day,
 * and both whenever a release is prepared. A release is offered as latest
 * only after `prepareRelease` stored its pack zip, Java version and every
 * client file. Singleton.
 */
class LauncherPackService {
  private static instance: LauncherPackService;

  private readonly preparing = new Set<number>();
  private readonly checking = new Set<number>();
  private readonly reportedBlocked = new Set<number>();

  static getInstance(): LauncherPackService {
    if (!LauncherPackService.instance) {
      LauncherPackService.instance = new LauncherPackService();
    }
    return LauncherPackService.instance;
  }

  /** The newest release that is ready for the launcher. Throws `PACK_UNAVAILABLE` (404) when there is none. */
  async getLatestPack(): Promise<LauncherPackData> {
    const modpack = await Q.modpack.find({
      curseforgeProjectId: config.curseforge.modpackProjectId,
    });
    const [release] = modpack
      ? await Q.modpack.release.findAll(
          { modpackId: modpack.id, launcherReadyAt: { $ne: null } },
          { orderBy: "id", orderDirection: "desc", limit: 1 },
        )
      : [];
    const pack = release ? toPackData(release) : null;
    if (!pack) {
      throw packError(
        LauncherPackErrorCode.PACK_UNAVAILABLE,
        404,
        "No modpack release is available to the launcher yet",
      );
    }
    return pack;
  }

  /**
   * Every release the launcher can install, newest first: ready for the
   * launcher and not found archived on CurseForge by the last `checkReleases`.
   * Each comes with its changelog: the mods it added, updated and removed
   * against the release recorded before it (listed or not), and the publish
   * notes. Paged, `page` counts from 0, with `total` counting every listed
   * release. Reads the database only. Empty when there is none or the page is
   * past the end.
   */
  async listReleases(paging: {
    page: number;
    limit: number;
  }): Promise<{ releases: LauncherPackRelease[]; total: number }> {
    const { page, limit } = paging;
    const modpack = await Q.modpack.find({
      curseforgeProjectId: config.curseforge.modpackProjectId,
    });
    if (!modpack) return { releases: [], total: 0 };

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
        const pack = toPackData(row);
        if (!pack) {
          logger.warn(
            `${modpack.name} release #${row.id} is ready for the launcher but cannot be served: a pack field is missing`,
          );
          return null;
        }
        return {
          ...pack,
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
   * stored only the pack zip decides. `getLatestPack` is not affected. No-op
   * for other modpacks and while another call checks the same pack. Throws
   * when CurseForge cannot be asked; nothing is changed then.
   */
  async checkReleases(modpack: Modpack): Promise<void> {
    if (
      modpack.curseforgeProjectId === null ||
      modpack.curseforgeProjectId !== config.curseforge.modpackProjectId ||
      this.checking.has(modpack.id)
    ) {
      return;
    }

    this.checking.add(modpack.id);
    try {
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
   * Download facts for CurseForge file ids from a pack manifest. Ids not stored
   * yet are resolved and stored first; throws `FILE_SOURCES_UNAVAILABLE` (503)
   * when that lookup fails. Ids that cannot be served (unknown to CurseForge,
   * no SHA-1, not a mod, resource pack or shader) come back in `unresolvedFileIds`.
   */
  async resolveFiles(fileIds: number[]): Promise<LauncherPackFilesData> {
    const ids = [...new Set(fileIds)];
    let stored: Map<number, CurseforgeFileWithProject>;
    try {
      stored = await this.ensureResolved(ids, {
        manualMaxAgeMs: MANUAL_RECHECK_MS,
        cdnMaxAgeMs: CDN_RECHECK_MS,
        strict: false,
      });
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
   * Makes a recorded release available to the launcher: resolves every client
   * file of its manifest, stores the pack zip's link and hash and the Java
   * version, then marks it ready. Posts to the admin notifications channel when
   * a client file ends up manual, or when the release cannot be made ready.
   * No-op for other modpacks, for a release that is already ready, and while
   * another call prepares the same release. Throws when CurseForge, Modrinth
   * or Mojang cannot be reached; the next reconcile tries again.
   */
  async prepareRelease(
    modpack: Modpack,
    releaseId: number,
    manifest: ModpackManifest,
  ): Promise<void> {
    if (
      modpack.curseforgeProjectId === null ||
      modpack.curseforgeProjectId !== config.curseforge.modpackProjectId ||
      this.preparing.has(releaseId)
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
        { manualMaxAgeMs: 0, cdnMaxAgeMs: 0, strict: true },
      );
      const unresolved = clientEntries.filter((entry) => {
        const row = stored.get(entry.fileId);
        return !row || packFolderForClass(row.classId) === null;
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

      const pack = await getModpackFile(
        modpack.curseforgeProjectId,
        manifest.fileId,
      );
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

      const javaMajorVersion = await getMinecraftJavaMajorVersion(
        manifest.minecraftVersion,
      );
      if (javaMajorVersion === null) {
        await this.reportBlocked(
          modpack,
          release,
          `Mojang lists no Java version for Minecraft ${manifest.minecraftVersion}`,
        );
        return;
      }

      const changed = await Q.modpack.release.updateAll(
        {
          version: manifest.version,
          minecraftVersion: manifest.minecraftVersion,
          modLoader: manifest.modLoader,
          packFileName: pack.fileName,
          packFileSize: pack.fileLength,
          packSha1: pack.sha1,
          packDownloadUrl: pack.downloadUrl,
          javaMajorVersion,
          launcherReadyAt: new Date(),
        },
        { id: release.id, launcherReadyAt: null },
      );
      if (changed === 0) return;

      this.reportedBlocked.delete(release.id);
      logger.info(
        `Modpack #${modpack.id} release ${manifest.version} is ready for the launcher: ${clientEntries.length} client files`,
      );

      const manual = clientEntries.filter(
        (entry) => stored.get(entry.fileId)?.source === "manual",
      );
      if (manual.length > 0) {
        await this.notifyManualFiles(modpack, manifest.version, manual, stored);
      }
    } finally {
      this.preparing.delete(releaseId);
    }
  }

  private async ensureResolved(
    fileIds: number[],
    options: { manualMaxAgeMs: number; cdnMaxAgeMs: number; strict: boolean },
  ): Promise<Map<number, CurseforgeFileWithProject>> {
    const ids = [...new Set(fileIds)];
    const stored = await this.loadStored(ids);
    const cdnFlag = await featureFlagService.readEnabled(
      FeatureFlags.launcherCurseforgeCdn,
    );
    const useCdn = cdnFlag === true;
    const cdnSwitchedOff = cdnFlag === false;

    const missing = ids.filter((id) => !stored.has(id));
    if (missing.length > 0) await this.resolveFromSources(missing, useCdn);

    const now = Date.now();
    const stale = [...stored.values()]
      .filter((row) => {
        const age = now - row.resolvedAt.getTime();
        if (row.source === "manual") return age >= options.manualMaxAgeMs;
        if (row.source === "curseforge-cdn") {
          return cdnSwitchedOff || (useCdn && age >= options.cdnMaxAgeMs);
        }
        return false;
      })
      .map((row) => row.id);
    if (stale.length > 0) {
      if (cdnSwitchedOff) {
        await Q.curseforge.file.updateAll(
          { source: "manual", downloadUrl: null },
          { id: { $in: stale }, source: "curseforge-cdn" },
        );
      }
      await Q.curseforge.file.updateAll(
        { resolvedAt: new Date() },
        { id: { $in: stale }, source: { $in: RECHECKED_SOURCES } },
      );
      try {
        await this.resolveFromSources(stale, useCdn);
      } catch (error) {
        if (options.strict) throw error;
        logger.warn(
          `Could not look up ${stale.length} pack file(s) again:`,
          error,
        );
      }
    }

    return missing.length > 0 || stale.length > 0
      ? this.loadStored(ids)
      : stored;
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
  ): Promise<void> {
    const label = `${modpack.name} ${release.version ?? `file ${release.curseforgeFileId}`}`;
    logger.warn(`${label} is not offered to the launcher: ${reason}`);
    if (this.reportedBlocked.has(release.id)) return;
    this.reportedBlocked.add(release.id);

    await this.notifyOwner(
      EmbedPresets.plain({
        title: "⛔ Launcher: release not offered",
        description: [
          `**Pack**: ${label}`,
          `The launcher keeps installing the previous release, because ${reason}.`,
          "Fix the release or publish a new one, then check the published pack again.",
        ].join("\n"),
        color: EmbedColors.Error,
      }),
    );
  }

  private async notifyManualFiles(
    modpack: Modpack,
    version: string,
    manual: ModpackManifestEntry[],
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
      const pageUrl = row ? curseforgeFilePageUrl(row, row.id) : null;
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
