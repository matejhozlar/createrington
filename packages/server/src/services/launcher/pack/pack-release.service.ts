import config from "@/config";
import { Q } from "@/db";
import type { CurseforgeFileWithProject } from "@/db/queries/curseforge/file";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import { getServedFileIds } from "@/services/curseforge/files";
import {
  getModpackFile,
  type ModpackManifest,
} from "@/services/curseforge/modpack";
import { refreshProjects } from "@/services/curseforge/ingest";
import { curseforgeFilePageUrl } from "@/services/launcher/content/curseforge-content";
import { getMinecraftJavaMajorVersion } from "@/services/content-gateway/minecraft";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import { packFolderForClass, parseModLoader } from "./pack-rules";
import {
  launcherPackFileService,
  NOTICE_MAX_FILES,
} from "./pack-files.service";

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

const RELEASE_NEXT_STEP =
  "Fix the release or publish a new one, then check the published pack again.";
const SNAPSHOT_NEXT_STEP =
  "Fix the cause and report the snapshot again, or restart the test server.";

/**
 * Makes recorded releases available to the launcher: `prepareRelease`
 * resolves every client file of a CurseForge release and stores its pack
 * zip's link and hash and the Java version before marking it ready,
 * `prepareSnapshot` does the same for a snapshot the sandbox verified and
 * retires the older ones, and `checkReleases` takes releases whose files
 * CurseForge archived out of the installable list and puts them back once
 * they are served again. Posts to the owner when a release cannot be offered
 * or a client file has no download source. Concurrent calls for the same
 * release or modpack are skipped.
 */
export class LauncherPackReleaseService {
  private readonly preparing = new Set<number>();
  private readonly checking = new Set<number>();
  private readonly reportedBlocked = new Set<number>();

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
      const stored = await launcherPackFileService.ensureResolved(
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

      const stored = await launcherPackFileService.ensureResolved(
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

  private async servesFromCurseforge(modpack: Modpack): Promise<boolean> {
    const pack = await Q.launcher.pack.find({ modpackId: modpack.id });
    return pack?.source === "curseforge";
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

export const launcherPackReleaseService = new LauncherPackReleaseService();
