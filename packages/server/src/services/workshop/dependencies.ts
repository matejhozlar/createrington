import { Q } from "@/db";
import { ConstraintViolationError } from "@/db/utils/errors";
import type { Workshop, WorkshopMod } from "@createrington/shared/db";
import {
  getFilesDependencies,
  getMods,
  getModpackModIds,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";
import { announcePulledDependencies, announceRemoval } from "./discord";

export const OPTIONAL_DEPENDENCY = 2;
export const REQUIRED_DEPENDENCY = 3;

/**
 * Resolve and store the dependencies of the given mods' chosen files. Batch
 * CurseForge calls only; deps satisfied by the base modpack are not stored.
 * Never throws, failures are logged and retried by the daily sweep.
 */
export async function resolveModDependencies(
  workshop: Workshop,
  mods: WorkshopMod[],
): Promise<void> {
  try {
    const withFile = mods.filter((mod) => mod.fileId !== null);
    if (withFile.length === 0) return;

    const fileDeps = await getFilesDependencies(
      withFile.map((mod) => mod.fileId!),
    );
    const depsByFile = new Map(
      fileDeps.map((file) => [file.fileId, file.dependencies]),
    );

    let basePackIds = new Set<number>();
    if (workshop.baseModpackProjectId) {
      try {
        basePackIds = await getModpackModIds(workshop.baseModpackProjectId);
      } catch {
        // Without the manifest some base-pack deps get stored; the next
        // sweep clears them
      }
    }

    const allDepIds = [
      ...new Set(
        withFile.flatMap((mod) =>
          (depsByFile.get(mod.fileId!) ?? [])
            .map((dep) => dep.modId)
            .filter((id) => !basePackIds.has(id)),
        ),
      ),
    ];
    if (allDepIds.length > 0) await refreshProjects(allDepIds);
    const cached =
      allDepIds.length > 0
        ? await Q.curseforge.project.findAll(
            { id: { $in: allDepIds } },
            { select: ["id"] },
          )
        : [];
    const cachedIds = new Set(cached.map((project) => project.id));

    for (const mod of withFile) {
      const deps = (depsByFile.get(mod.fileId!) ?? []).filter(
        (dep) => !basePackIds.has(dep.modId) && cachedIds.has(dep.modId),
      );
      await Q.workshop.mod.dependency.deleteAll({ workshopModId: mod.id });
      for (const dep of deps) {
        await Q.workshop.mod.dependency.create({
          workshopModId: mod.id,
          curseforgeProjectId: dep.modId,
          relationType: dep.relationType,
        });
      }
    }
  } catch (error) {
    logger.warn(`Dependency resolution failed: ${error}`);
  }
}

/**
 * Auto-add the missing required dependencies of an approved mod as approved
 * 'dependency'-sourced entries, recording which mod pulled them in. Banned,
 * claimed, and incompatible dependencies are skipped with a warning.
 * Never throws.
 */
export async function promoteRequiredDependencies(
  workshop: Workshop,
  mod: WorkshopMod,
  actorId: string,
): Promise<void> {
  try {
    let deps = await Q.workshop.mod.dependency.findAll({
      workshopModId: mod.id,
      relationType: REQUIRED_DEPENDENCY,
    });
    if (deps.length === 0 && mod.fileId !== null) {
      await resolveModDependencies(workshop, [mod]);
      deps = await Q.workshop.mod.dependency.findAll({
        workshopModId: mod.id,
        relationType: REQUIRED_DEPENDENCY,
      });
    }
    if (deps.length === 0) return;

    const depIds = deps.map((dep) => dep.curseforgeProjectId);
    const existing = await Q.workshop.mod.findAll({
      workshopId: workshop.id,
      curseforgeProjectId: { $in: depIds },
    });
    const rejectedIds = new Set(
      existing
        .filter((row) => row.status === "rejected")
        .map((row) => row.curseforgeProjectId),
    );
    const claimedIds = new Set(existing.map((row) => row.curseforgeProjectId));
    for (const id of rejectedIds) {
      logger.warn(
        `Required dependency #${id} of workshop mod #${mod.id} is rejected in this workshop and cannot ship`,
      );
    }

    const missing = depIds.filter((id) => !claimedIds.has(id));
    if (missing.length === 0) return;

    const projects = await getMods(missing);
    const created: WorkshopMod[] = [];
    for (const data of projects) {
      if (data.classId !== workshop.classId) {
        logger.warn(
          `Required dependency "${data.name}" is not the right kind of project, skipped`,
        );
        continue;
      }
      const file = pickCompatibleFile(workshop, data);
      if (!file) {
        logger.warn(
          `Required dependency "${data.name}" has no file for ${workshop.gameVersion}, skipped`,
        );
        continue;
      }
      try {
        const row = await Q.workshop.mod.createAndReturn({
          workshopId: workshop.id,
          curseforgeProjectId: data.id,
          source: "dependency",
          submittedBy: actorId,
          status: "approved",
          note: null,
          reviewedBy: actorId,
          reviewedAt: new Date(),
          fileId: file.fileId,
          fileName: file.filename,
          fileReleaseType: file.releaseType,
        });
        created.push(row);
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
    }
    if (created.length > 0) {
      logger.info(
        `Pulled ${created.length} required dependencies into workshop #${workshop.id}`,
      );
      await resolveModDependencies(workshop, created);
      const nameById = new Map(projects.map((data) => [data.id, data.name]));
      void announcePulledDependencies(
        mod,
        created.map(
          (row) =>
            nameById.get(row.curseforgeProjectId) ??
            `#${row.curseforgeProjectId}`,
        ),
      );
    }
  } catch (error) {
    logger.warn(`Dependency promotion failed for mod #${mod.id}: ${error}`);
  }
}

/**
 * Delete dependency-sourced rows that no approved mod requires anymore,
 * following chains until stable. Never throws.
 */
export async function pruneOrphanedDependencies(
  workshopId: number,
): Promise<void> {
  try {
    for (;;) {
      const mods = await Q.workshop.mod.findAll({ workshopId });
      const approvedIds = mods
        .filter((mod) => mod.status === "approved")
        .map((mod) => mod.id);
      const required =
        approvedIds.length > 0
          ? await Q.workshop.mod.dependency.findAll({
              workshopModId: { $in: approvedIds },
              relationType: REQUIRED_DEPENDENCY,
            })
          : [];
      const requiredProjectIds = new Set(
        required.map((dep) => dep.curseforgeProjectId),
      );

      const orphans = mods.filter(
        (mod) =>
          mod.source === "dependency" &&
          mod.status === "approved" &&
          !requiredProjectIds.has(mod.curseforgeProjectId),
      );
      if (orphans.length === 0) return;

      await Q.workshop.mod.deleteAll({
        id: { $in: orphans.map((mod) => mod.id) },
      });
      for (const orphan of orphans) {
        void announceRemoval(orphan);
      }
      logger.info(
        `Pruned ${orphans.length} orphaned dependencies from workshop #${workshopId}`,
      );
    }
  } catch (error) {
    logger.warn(
      `Dependency pruning failed for workshop #${workshopId}: ${error}`,
    );
  }
}

// Deps prefer the workshop's exact loader but fall back to any file for the game
// version: the chosen file is re-resolved at pack build time anyway
function pickCompatibleFile(workshop: Workshop, data: CurseForgeProjectData) {
  return (
    data.latestFilesIndexes.find(
      (idx) =>
        idx.gameVersion === workshop.gameVersion &&
        idx.modLoader === workshop.modLoaderType,
    ) ??
    data.latestFilesIndexes.find(
      (idx) => idx.gameVersion === workshop.gameVersion,
    ) ??
    null
  );
}
