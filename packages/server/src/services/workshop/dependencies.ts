import { db, Q } from "@/db";
import type { Workshop, WorkshopModStatus } from "@createrington/shared/db";
import { getFilesDependencies, getModpackModIds } from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";

import {
  OPTIONAL_DEPENDENCY,
  REQUIRED_DEPENDENCY,
  type DependencyCoverage,
} from "@createrington/shared/workshop";

export { OPTIONAL_DEPENDENCY, REQUIRED_DEPENDENCY, type DependencyCoverage };

export interface DependencySubject {
  curseforgeProjectId: number;
  fileId: number | null;
}

/**
 * Resolve and store the dependencies of the given projects' chosen files,
 * keyed by project so suggestions and modpack mods share one cache. Batch
 * CurseForge calls only; deps satisfied by the base modpack are not stored.
 * Throws when CurseForge cannot be reached; callers that treat resolution as
 * best-effort should use `tryResolveProjectDependencies`.
 */
export async function resolveProjectDependencies(
  workshop: Workshop,
  subjects: DependencySubject[],
): Promise<void> {
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

  const edges = withFile.flatMap((subject) =>
    (depsByFile.get(subject.fileId!) ?? [])
      .filter((dep) => !basePackIds.has(dep.modId) && cachedIds.has(dep.modId))
      .map((dep) => ({
        workshopId: workshop.id,
        curseforgeProjectId: subject.curseforgeProjectId,
        dependsOnProjectId: dep.modId,
        relationType: dep.relationType,
      })),
  );
  await db.inTransaction(async (tx) => {
    await tx.workshop.project.dependency.deleteAll({
      workshopId: workshop.id,
      curseforgeProjectId: {
        $in: withFile.map((subject) => subject.curseforgeProjectId),
      },
    });
    await tx.workshop.project.dependency.createMany(edges);
  });
}

/**
 * Fire-and-forget variant of `resolveProjectDependencies`: failures are
 * logged and retried by the daily sweep.
 */
export async function tryResolveProjectDependencies(
  workshop: Workshop,
  subjects: DependencySubject[],
): Promise<void> {
  try {
    await resolveProjectDependencies(workshop, subjects);
  } catch (error) {
    logger.warn("Dependency resolution failed:", error);
  }
}

export interface DependencyContext {
  coverage: Map<number, DependencyCoverage>;
  demand: Map<number, number>;
}

const COVERAGE_BY_STATUS: Record<WorkshopModStatus, DependencyCoverage> = {
  pending: "in_review",
  approved: "in_review",
  testing: "in_review",
  next_update: "staged",
  in_pack: "published",
  rejected: "rejected",
};

/**
 * Resolve every dependency's coverage and how many shipping mods want it, so
 * a suggestion can show what it still drags in without any of those
 * dependencies needing a row of their own. `projectIds` restricts both maps
 * to the projects a caller will look up; omit it for the whole workshop.
 */
export async function loadDependencyContext(
  workshop: Workshop,
  projectIds?: number[],
): Promise<DependencyContext> {
  const [standings, demand] = await Promise.all([
    Q.workshop.mod.getProjectStandings(
      workshop.id,
      workshop.modpackId,
      projectIds,
    ),
    Q.workshop.project.dependency.getShippingDemand(
      workshop.id,
      workshop.modpackId,
      REQUIRED_DEPENDENCY,
      projectIds,
    ),
  ]);

  const coverage = new Map<number, DependencyCoverage>();
  for (const row of standings) {
    coverage.set(
      row.curseforgeProjectId,
      row.inPack || row.status === null
        ? "published"
        : COVERAGE_BY_STATUS[row.status],
    );
  }

  return { coverage, demand };
}

/**
 * Delete dependency edges whose subject project no longer has a modpack row
 * or a live suggestion, keeping the per-workshop cache bounded. Never throws.
 */
export async function pruneStaleDependencyEdges(
  workshop: Workshop,
): Promise<void> {
  try {
    await Q.workshop.project.dependency.deleteStale(
      workshop.id,
      workshop.modpackId,
    );
  } catch (error) {
    logger.warn(
      `Dependency edge cleanup failed for workshop #${workshop.id}:`,
      error,
    );
  }
}
