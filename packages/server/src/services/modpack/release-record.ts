import { Q, db } from "@/db";
import { UniqueViolationError } from "@/db/utils/errors";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import type { ReleaseModInsert } from "@/db/queries/modpack/release/mod";
import { getFilesDetails } from "@/services/curseforge/files";
import type { ModpackManifest } from "@/services/curseforge/modpack";
import { launcherPackReleaseService } from "@/services/launcher/pack/pack-release.service";
import { announceReleaseChangelog } from "./changelog";
import { getReleaseDiff } from "./release-changelog";
import config from "@/config";

function firstPerProject<T extends { curseforgeProjectId: number }>(
  rows: T[],
): T[] {
  const held = new Map<number, T>();
  for (const row of rows) {
    if (!held.has(row.curseforgeProjectId)) {
      held.set(row.curseforgeProjectId, row);
    }
  }
  return [...held.values()];
}

/**
 * Freeze what a published pack file shipped. CurseForge stops serving files
 * once they are archived, so every column a diff needs is copied in here and
 * nothing in the history path ever reads CurseForge again.
 */
export async function recordRelease(
  modpack: Modpack,
  manifest: ModpackManifest,
): Promise<void> {
  if (manifest.entries.length === 0) return;
  // Releases read before the server pack was fetched alongside the client
  // file are keyed by the server pack id, so a re-read must match either
  const [recorded] = await Q.modpack.release.findAll(
    {
      modpackId: modpack.id,
      curseforgeFileId: {
        $in:
          manifest.serverPackFileId === null
            ? [manifest.fileId]
            : [manifest.fileId, manifest.serverPackFileId],
      },
    },
    { limit: 1 },
  );
  if (recorded) {
    if (
      manifest.serverPackFileId !== null &&
      recorded.curseforgeFileId === manifest.fileId &&
      recorded.serverPackFileId === null
    ) {
      await upgradeRelease(modpack, recorded, manifest);
      announceRelease(modpack, recorded.id, true);
    } else if (recorded.serverPackFileId !== null) {
      announceRelease(modpack, recorded.id, false);
    }
    if (recorded.launcherReadyAt === null) {
      prepareForLauncher(modpack, recorded.id, manifest);
    }
    return;
  }

  const rows = await buildReleaseRows(manifest);
  if (rows.length === 0) return;

  // A half-written release would be permanent: the guard above sees the
  // release row and never repairs the missing membership
  let releaseId: number;
  try {
    releaseId = await db.inTransaction(async (tx) => {
      const release = await tx.modpack.release.createAndReturn({
        modpackId: modpack.id,
        curseforgeFileId: manifest.fileId,
        serverPackFileId: manifest.serverPackFileId,
        version: manifest.version,
        displayName: manifest.displayName,
        minecraftVersion: manifest.minecraftVersion,
        modLoader: manifest.modLoader,
        modCount: new Set(rows.map((row) => row.curseforgeProjectId)).size,
        publishedAt: manifest.publishedAt
          ? new Date(manifest.publishedAt)
          : null,
      });
      await tx.modpack.release.mod.insertMany(release.id, rows);
      await tx.modpack.mod.applyManifestFiles(
        modpack.id,
        firstPerProject(rows),
      );
      return release.id;
    });
  } catch (error) {
    if (error instanceof UniqueViolationError) return;
    throw error;
  }

  logger.info(
    `Recorded modpack #${modpack.id} release ${
      manifest.version ?? manifest.fileId
    } with ${rows.length} mods`,
  );
  if (manifest.serverPackFileId !== null) {
    announceRelease(modpack, releaseId, true);
  }
  prepareForLauncher(modpack, releaseId, manifest);
}

async function upgradeRelease(
  modpack: Modpack,
  release: ModpackRelease,
  manifest: ModpackManifest,
): Promise<void> {
  const rows = await buildReleaseRows(manifest);
  if (rows.length === 0) return;

  await db.inTransaction(async (tx) => {
    await tx.modpack.release.mod.deleteAll({ releaseId: release.id });
    await tx.modpack.release.mod.insertMany(release.id, rows);
    await tx.modpack.release.updateAll(
      {
        serverPackFileId: manifest.serverPackFileId,
        modCount: new Set(rows.map((row) => row.curseforgeProjectId)).size,
      },
      { id: release.id },
    );
    await tx.modpack.mod.applyManifestFiles(modpack.id, firstPerProject(rows));
  });

  logger.info(
    `Re-recorded modpack #${modpack.id} release ${
      manifest.version ?? manifest.fileId
    } with its server pack: ${rows.length} mods`,
  );
}

export async function buildReleaseRows(
  manifest: ModpackManifest,
): Promise<ReleaseModInsert[]> {
  const projectIds = [...new Set(manifest.entries.map((e) => e.projectId))];
  const cached = new Set(
    (
      await Q.curseforge.project.findAll(
        { id: { $in: projectIds } },
        { select: ["id"] },
      )
    ).map((project) => project.id),
  );
  // A manifest can repeat a (project, file) pair, which the unique index
  // would reject and take the whole release down with it
  const seen = new Set<string>();
  const entries = manifest.entries.filter((entry) => {
    if (!cached.has(entry.projectId)) return false;
    const key = `${entry.projectId}:${entry.fileId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (entries.length === 0) return [];

  const details = new Map(
    (await getFilesDetails(entries.map((e) => e.fileId))).map((detail) => [
      detail.fileId,
      detail,
    ]),
  );

  return entries.map((entry) => {
    const detail = details.get(entry.fileId);
    return {
      curseforgeProjectId: entry.projectId,
      fileId: entry.fileId,
      fileName: detail?.fileName ?? null,
      displayName: detail?.displayName ?? null,
      fileReleaseType: detail?.releaseType ?? null,
      fileDate: detail?.fileDate ? new Date(detail.fileDate) : null,
      required: entry.required,
      inClientPack: entry.sides !== "server",
    };
  });
}

function announceRelease(
  modpack: Modpack,
  releaseId: number,
  start: boolean,
): void {
  void announceReleaseChangelog({
    modpack,
    releaseId,
    start,
    loadDiff: () => getReleaseDiff(releaseId),
  }).catch((error) => {
    logger.warn(
      `Modpack #${modpack.id} release #${releaseId} changelog failed:`,
      error,
    );
  });
}

function prepareForLauncher(
  modpack: Modpack,
  releaseId: number,
  manifest: ModpackManifest,
): void {
  if (!config.launcher.available) return;
  void launcherPackReleaseService
    .prepareRelease(modpack, releaseId, manifest)
    .catch((error) => {
      logger.warn(
        `Modpack #${modpack.id} release #${releaseId} could not be prepared for the launcher:`,
        error,
      );
    });
}

export function checkLauncherReleases(modpack: Modpack): void {
  if (!config.launcher.available) return;
  void launcherPackReleaseService.checkReleases(modpack).catch((error) => {
    logger.warn(
      `Modpack #${modpack.id} releases could not be checked for the launcher:`,
      error,
    );
  });
}
