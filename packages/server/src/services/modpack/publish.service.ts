import { Q, db } from "@/db";
import { BadRequestError, NotFoundError } from "@/app/middleware/error-handler";
import { UniqueViolationError } from "@/db/utils/errors";
import type {
  Modpack,
  ModpackPublish,
  ModpackRelease,
} from "@createrington/shared/db";
import {
  getModpackFile,
  manifestDisabledModIds,
  type ModpackManifestEntry,
} from "@/services/curseforge/modpack";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { findSandboxSnapshotUrl } from "@/services/launcher/pack/sandbox-files";
import { modpackService } from "./modpack.service";
import { buildReleaseRows } from "./release-record";
import { modpackSyncService } from "./sync.service";

export interface ModpackPublishReport {
  projectId: number;
  clientFileId: number;
  serverPackFileId: number;
  notes?: string;
}

export interface ModpackSnapshotReport {
  slug: string;
  snapshotId: number;
  version: string;
  minecraftVersion: string;
  modLoader: string;
  zip: { fileName: string; size: number; sha1: string };
  files: Array<{ projectId: number; fileId: number; required: boolean }>;
  notes?: string;
}

export interface ModpackSnapshotResult {
  release: ModpackRelease;
  ready: boolean;
  error: string | null;
}

export interface ModpackPublishResult {
  publish: ModpackPublish;
  ingested: boolean;
  error: string | null;
}

/**
 * Takes the sandbox's reports of what it published. A CurseForge publish is
 * checked against CurseForge and stored for reconcile to read the release
 * from; a snapshot of a sandbox-sourced launcher pack is recorded as a release
 * and readied for the launcher. Failures after the report is stored come back
 * as `error` instead of throwing, so a report is never lost.
 */
export class ModpackPublishService {
  /**
   * Take the sandbox's word for a release it published: the client file and
   * the server pack it uploaded, checked against CurseForge (both served,
   * the server pack a child of the client file). The pair is stored for
   * reconcile to read the release from, then a forced reconcile runs right
   * away. A refused or failed reconcile is kept on the report for the
   * sandbox to show and returned instead of thrown, so the report itself
   * never gets lost.
   */
  async recordPublish(
    report: ModpackPublishReport,
  ): Promise<ModpackPublishResult> {
    const modpack = await Q.modpack.find({
      curseforgeProjectId: report.projectId,
    });
    if (!modpack) {
      throw new NotFoundError(
        `No modpack follows CurseForge project #${report.projectId}`,
      );
    }

    const client = await getModpackFile(report.projectId, report.clientFileId);
    if (!client?.isAvailable) {
      throw new BadRequestError(
        `CurseForge does not serve file ${report.clientFileId} of project #${report.projectId} yet`,
      );
    }
    const server = await getModpackFile(
      report.projectId,
      report.serverPackFileId,
    );
    if (!server?.isAvailable) {
      throw new BadRequestError(
        `CurseForge does not serve file ${report.serverPackFileId} of project #${report.projectId} yet`,
      );
    }
    if (server.parentProjectFileId !== client.id) {
      throw new BadRequestError(
        `File ${server.id} is not an additional file of ${client.id}, so it cannot be its server pack`,
      );
    }

    const publish = await this.upsertPublish(
      modpack.id,
      client.id,
      server.id,
      report.notes === undefined ? undefined : report.notes.trim() || null,
    );
    if (!modpack.shipsServerPack) {
      await Q.modpack.updateAll(
        { shipsServerPack: true, updatedAt: new Date() },
        { id: modpack.id },
      );
    }

    let error: string | null = null;
    try {
      await modpackSyncService.reconcile(modpack.id, { force: true });
      const read = await getModpackManifest(report.projectId);
      if (read.fileId !== client.id) {
        error = `CurseForge lists file ${read.fileId} as newer than ${client.id}, so the main app read that release instead; the report is kept for when ${client.id} is read`;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      logger.warn(
        `Modpack #${modpack.id} reconcile after publish report ${client.id}/${server.id} failed:`,
        caught,
      );
    }
    if (error !== null) {
      await Q.modpack.publish.updateAll(
        { lastError: error },
        { id: publish.id },
      );
    }
    const stored = await Q.modpack.publish.get({ id: publish.id });
    return { publish: stored, ingested: stored.ingestedAt !== null, error };
  }

  /**
   * Take the sandbox's word for a snapshot of a pack whose releases it
   * reports: the zip it keeps under the snapshot id is read back through the
   * internal address and checked against the reported SHA-1 and size, the
   * snapshot is recorded as a release keyed by that id with its frozen file
   * list, the notes are kept on a publish row, and the release is readied
   * for the launcher, which retires every older snapshot. A snapshot that is
   * already ready is answered as it is. Throws `NotFoundError` for a slug no
   * sandbox pack carries and `BadRequestError` when the sandbox does not
   * serve the zip as reported; a snapshot that cannot be readied is recorded
   * anyway and the reason comes back as `error`, so a resend can finish it.
   */
  async recordSnapshot(
    report: ModpackSnapshotReport,
  ): Promise<ModpackSnapshotResult> {
    const pack = await Q.launcher.pack.find({ slug: report.slug });
    if (!pack || pack.source !== "sandbox") {
      throw new NotFoundError(
        `The launcher offers no pack as "${report.slug}" whose releases the sandbox reports`,
      );
    }
    const modpack = await modpackService.getModpack(pack.modpackId);
    const notes =
      report.notes === undefined ? undefined : report.notes.trim() || null;

    const recorded = await Q.modpack.release.find({
      modpackId: modpack.id,
      curseforgeFileId: report.snapshotId,
    });
    if (recorded?.launcherReadyAt) {
      if (notes !== undefined) {
        await this.upsertPublish(modpack.id, report.snapshotId, null, notes);
      }
      return this.snapshotAnswer(recorded, null);
    }

    const [newest] = await Q.modpack.release.findAll(
      { modpackId: modpack.id, launcherReadyAt: { $ne: null } },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );
    if (newest && newest.curseforgeFileId > report.snapshotId) {
      const error = `Snapshot ${newest.curseforgeFileId} is newer and already offered, so snapshot ${report.snapshotId} will not be`;
      if (recorded) {
        await Q.modpack.publish.updateAll(
          { lastError: error },
          { modpackId: modpack.id, clientFileId: report.snapshotId },
        );
      }
      return { release: recorded ?? newest, ready: false, error };
    }

    const downloadUrl = await findSandboxSnapshotUrl({
      snapshotId: report.snapshotId,
      sha1: report.zip.sha1,
      size: report.zip.size,
    });
    if (!downloadUrl) {
      throw new BadRequestError(
        `The sandbox does not serve snapshot ${report.snapshotId} with the reported SHA-1 and size, so the main app cannot offer it`,
      );
    }

    const release =
      recorded ?? (await this.recordSnapshotRelease(modpack, report, notes));
    if (notes !== undefined && recorded) {
      await this.upsertPublish(modpack.id, report.snapshotId, null, notes);
    }

    let error: string | null = null;
    try {
      const outcome = await launcherPackService.prepareSnapshot(
        modpack,
        release.id,
        {
          version: report.version,
          minecraftVersion: report.minecraftVersion,
          modLoader: report.modLoader,
          zip: { ...report.zip, downloadUrl },
          entries: report.files,
        },
      );
      if (outcome.status === "busy") {
        return {
          release: await Q.modpack.release.get({ id: release.id }),
          ready: false,
          error:
            "The snapshot is being prepared for an earlier report; ask again in a moment",
        };
      }
      if (outcome.status === "blocked") error = outcome.reason;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      logger.warn(
        `Modpack #${modpack.id} snapshot ${report.snapshotId} could not be prepared for the launcher:`,
        caught,
      );
    }

    const answer = this.snapshotAnswer(
      await Q.modpack.release.get({ id: release.id }),
      error,
    );
    await Q.modpack.publish.updateAll(
      {
        ingestedAt: answer.ready ? new Date() : null,
        lastError: answer.error,
      },
      { modpackId: modpack.id, clientFileId: report.snapshotId },
    );
    return answer;
  }

  private snapshotAnswer(
    release: ModpackRelease,
    error: string | null,
  ): ModpackSnapshotResult {
    const ready =
      release.launcherReadyAt !== null &&
      release.launcherUnavailableAt === null;
    return {
      release,
      ready,
      error:
        error ??
        (ready || release.launcherReadyAt === null
          ? null
          : "A newer snapshot is offered instead, so this one no longer is"),
    };
  }

  private async recordSnapshotRelease(
    modpack: Modpack,
    report: ModpackSnapshotReport,
    notes: string | null | undefined,
  ): Promise<ModpackRelease> {
    const entries: ModpackManifestEntry[] = report.files.map((file) => ({
      ...file,
      sides: "client",
    }));
    const rows = await buildReleaseRows({
      fileId: report.snapshotId,
      serverPackFileId: null,
      displayName: null,
      version: report.version,
      minecraftVersion: report.minecraftVersion,
      modLoader: report.modLoader,
      publishedAt: null,
      entries,
      modIds: new Set(entries.map((entry) => entry.projectId)),
      disabledModIds: manifestDisabledModIds(entries),
    });

    await this.upsertPublish(modpack.id, report.snapshotId, null, notes);
    try {
      return await db.inTransaction(async (tx) => {
        const release = await tx.modpack.release.createAndReturn({
          modpackId: modpack.id,
          curseforgeFileId: report.snapshotId,
          serverPackFileId: null,
          version: report.version,
          displayName: null,
          minecraftVersion: report.minecraftVersion,
          modLoader: report.modLoader,
          modCount: new Set(rows.map((row) => row.curseforgeProjectId)).size,
          publishedAt: new Date(),
        });
        await tx.modpack.release.mod.insertMany(release.id, rows);
        return release;
      });
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        return Q.modpack.release.get({
          modpackId: modpack.id,
          curseforgeFileId: report.snapshotId,
        });
      }
      throw error;
    }
  }

  private async upsertPublish(
    modpackId: number,
    clientFileId: number,
    serverPackFileId: number | null,
    notes: string | null | undefined,
  ): Promise<ModpackPublish> {
    const refresh = async (id: number) =>
      Q.modpack.publish.updateAndReturn(
        { id },
        {
          serverPackFileId,
          reportedAt: new Date(),
          ingestedAt: null,
          lastError: null,
          ...(notes !== undefined && { notes }),
        },
      );
    const existing = await Q.modpack.publish.find({ modpackId, clientFileId });
    if (existing) return refresh(existing.id);
    try {
      return await Q.modpack.publish.createAndReturn({
        modpackId,
        clientFileId,
        serverPackFileId,
        notes: notes ?? null,
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const raced = await Q.modpack.publish.get({ modpackId, clientFileId });
      return refresh(raced.id);
    }
  }
}

export const modpackPublishService = new ModpackPublishService();
