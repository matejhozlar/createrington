import { db, Q } from "@/db";
import { ConstraintViolationError } from "@/db/utils/errors";
import type { Workshop, ModpackMod } from "@createrington/shared/db";
import {
  getFilesDependencies,
  getMods,
  getModpackModIds,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";
import { announcePulledDependencies } from "./discord";

export const OPTIONAL_DEPENDENCY = 2;
export const REQUIRED_DEPENDENCY = 3;

export interface DependencySubject {
  curseforgeProjectId: number;
  fileId: number | null;
}

/**
 * Resolve and store the dependencies of the given projects' chosen files,
 * keyed by project so suggestions and modpack mods share one cache. Batch
 * CurseForge calls only; deps satisfied by the base modpack are not stored.
 * Never throws, failures are logged and retried by the daily sweep.
 */
export async function resolveProjectDependencies(
  workshop: Workshop,
  subjects: DependencySubject[],
): Promise<void> {
  try {
    const withFile = subjects.filter((subject) => subject.fileId !== null);
    if (withFile.length === 0) return;

    const fileDeps = await getFilesDependencies(
      withFile.map((subject) => subject.fileId!),
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
        withFile.flatMap((subject) =>
          (depsByFile.get(subject.fileId!) ?? [])
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

    for (const subject of withFile) {
      const deps = (depsByFile.get(subject.fileId!) ?? []).filter(
        (dep) => !basePackIds.has(dep.modId) && cachedIds.has(dep.modId),
      );
      await db.inTransaction(async (tx) => {
        await tx.workshop.project.dependency.deleteAll({
          workshopId: workshop.id,
          curseforgeProjectId: subject.curseforgeProjectId,
        });
        for (const dep of deps) {
          await tx.workshop.project.dependency.create({
            workshopId: workshop.id,
            curseforgeProjectId: subject.curseforgeProjectId,
            dependsOnProjectId: dep.modId,
            relationType: dep.relationType,
          });
        }
      });
    }
  } catch (error) {
    logger.warn("Dependency resolution failed:", error);
  }
}

/**
 * Auto-add the missing required dependencies of a modpack mod as
 * 'dependency'-origin rows. Dependencies with a suggestion row are left to
 * normal review; rejected and incompatible ones are skipped with a warning.
 * When no stored edges exist the mod's file is re-resolved against the API
 * first; pass resolveIfEmpty false when resolution just ran, since a mod with
 * zero dependencies is indistinguishable from an unresolved one. Never throws.
 */
export async function promoteRequiredDependencies(
  workshop: Workshop,
  packMod: ModpackMod,
  actorId: string,
  options: { resolveIfEmpty?: boolean } = {},
): Promise<void> {
  try {
    let deps = await Q.workshop.project.dependency.findAll({
      workshopId: workshop.id,
      curseforgeProjectId: packMod.curseforgeProjectId,
      relationType: REQUIRED_DEPENDENCY,
    });
    if (
      deps.length === 0 &&
      packMod.fileId !== null &&
      (options.resolveIfEmpty ?? true)
    ) {
      await resolveProjectDependencies(workshop, [packMod]);
      deps = await Q.workshop.project.dependency.findAll({
        workshopId: workshop.id,
        curseforgeProjectId: packMod.curseforgeProjectId,
        relationType: REQUIRED_DEPENDENCY,
      });
    }
    if (deps.length === 0) return;

    const depIds = deps.map((dep) => dep.dependsOnProjectId);
    const [claimedRows, suggestions] = await Promise.all([
      Q.modpack.mod.findAll({
        modpackId: workshop.modpackId,
        curseforgeProjectId: { $in: depIds },
      }),
      Q.workshop.mod.findAll({
        workshopId: workshop.id,
        curseforgeProjectId: { $in: depIds },
      }),
    ]);
    const claimedIds = new Set(
      claimedRows.map((row) => row.curseforgeProjectId),
    );
    const suggestedIds = new Set(
      suggestions.map((row) => row.curseforgeProjectId),
    );
    for (const row of suggestions) {
      if (row.status === "rejected") {
        logger.warn(
          `Required dependency #${row.curseforgeProjectId} of modpack mod #${packMod.id} is rejected in this workshop and cannot ship`,
        );
      }
    }

    const missing = depIds.filter(
      (id) => !claimedIds.has(id) && !suggestedIds.has(id),
    );
    if (missing.length === 0) return;

    const projects = await getMods(missing);
    const created: ModpackMod[] = [];
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
        const row = await Q.modpack.mod.createAndReturn({
          modpackId: workshop.modpackId,
          curseforgeProjectId: data.id,
          origin: "dependency",
          workshopModId: null,
          addedBy: actorId,
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
        `Pulled ${created.length} required dependencies into modpack #${workshop.modpackId}`,
      );
      await resolveProjectDependencies(workshop, created);
      if (packMod.workshopModId) {
        const suggestion = await Q.workshop.mod.find({
          id: packMod.workshopModId,
        });
        if (suggestion) {
          const nameById = new Map(
            projects.map((data) => [data.id, data.name]),
          );
          void announcePulledDependencies(
            suggestion,
            created.map(
              (row) =>
                nameById.get(row.curseforgeProjectId) ??
                `#${row.curseforgeProjectId}`,
            ),
          );
        }
      }
    }
  } catch (error) {
    logger.warn(
      `Dependency promotion failed for modpack mod #${packMod.id}:`,
      error,
    );
  }
}

/**
 * Delete dependency-origin modpack rows that no remaining member requires,
 * transitively. Requirement edges come from every workshop feeding the
 * modpack; only rows reachable from non-dependency roots survive, so cycles
 * of dependencies keeping each other alive are collected too. Never throws.
 */
export async function pruneOrphanedDependencies(
  modpackId: number,
): Promise<void> {
  try {
    const workshops = await Q.workshop.findAll(
      { modpackId },
      { select: ["id"] },
    );
    const workshopIds = workshops.map((w) => w.id);

    const rows = await Q.modpack.mod.findAll({ modpackId });
    const projectIds = rows.map((row) => row.curseforgeProjectId);
    const required =
      projectIds.length > 0 && workshopIds.length > 0
        ? await Q.workshop.project.dependency.findAll({
            workshopId: { $in: workshopIds },
            curseforgeProjectId: { $in: projectIds },
            relationType: REQUIRED_DEPENDENCY,
          })
        : [];
    const requiresByProject = new Map<number, number[]>();
    for (const dep of required) {
      const list = requiresByProject.get(dep.curseforgeProjectId) ?? [];
      list.push(dep.dependsOnProjectId);
      requiresByProject.set(dep.curseforgeProjectId, list);
    }

    // Live rows are in the published manifest and stay until a publish
    // drops them, no matter what the dependency graph says
    const memberIds = new Set(projectIds);
    const queue = rows
      .filter((row) => row.origin !== "dependency" || row.liveAt !== null)
      .map((row) => row.curseforgeProjectId);
    const reachable = new Set(queue);
    while (queue.length > 0) {
      const projectId = queue.pop()!;
      for (const depId of requiresByProject.get(projectId) ?? []) {
        if (memberIds.has(depId) && !reachable.has(depId)) {
          reachable.add(depId);
          queue.push(depId);
        }
      }
    }

    const orphans = rows.filter(
      (row) =>
        row.origin === "dependency" &&
        row.liveAt === null &&
        !reachable.has(row.curseforgeProjectId),
    );
    if (orphans.length === 0) return;

    await Q.modpack.mod.deleteAll({
      id: { $in: orphans.map((row) => row.id) },
    });
    logger.info(
      `Pruned ${orphans.length} orphaned dependencies from modpack #${modpackId}`,
    );
  } catch (error) {
    logger.warn(`Dependency pruning failed for modpack #${modpackId}:`, error);
  }
}

/**
 * Delete dependency edges whose subject project no longer has a modpack row
 * or a live suggestion, keeping the per-workshop cache bounded. Never throws.
 */
export async function pruneStaleDependencyEdges(
  workshop: Workshop,
): Promise<void> {
  try {
    const [edges, packRows, suggestions] = await Promise.all([
      Q.workshop.project.dependency.findAll({ workshopId: workshop.id }),
      Q.modpack.mod.findAll({ modpackId: workshop.modpackId }),
      Q.workshop.mod.findAll({
        workshopId: workshop.id,
        status: { $ne: "rejected" },
      }),
    ]);
    const liveProjectIds = new Set([
      ...packRows.map((row) => row.curseforgeProjectId),
      ...suggestions.map((row) => row.curseforgeProjectId),
    ]);
    const stale = edges.filter(
      (edge) => !liveProjectIds.has(edge.curseforgeProjectId),
    );
    if (stale.length === 0) return;
    await Q.workshop.project.dependency.deleteAll({
      id: { $in: stale.map((edge) => edge.id) },
    });
  } catch (error) {
    logger.warn(
      `Dependency edge cleanup failed for workshop #${workshop.id}:`,
      error,
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
