import { db, Q } from "@/db";
import type { Workshop, WorkshopModStatus } from "@createrington/shared/db";
import { getFilesDependencies, getModpackModIds } from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";

import {
  OPTIONAL_DEPENDENCY,
  REQUIRED_DEPENDENCY,
} from "@createrington/shared/workshop";

export { OPTIONAL_DEPENDENCY, REQUIRED_DEPENDENCY };

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
 * Where a dependency stands relative to the pack: already published, staged
 * for the next update, still in review, ruled out, or nowhere yet. Only
 * `missing` and `rejected` mean the pack cannot ship complete.
 */
export type DependencyCoverage =
  "published" | "staged" | "in_review" | "rejected" | "missing";

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
 * dependencies needing a row of their own.
 */
export async function loadDependencyContext(
  workshop: Workshop,
): Promise<DependencyContext> {
  const [packRows, suggestions, edges] = await Promise.all([
    Q.modpack.mod.findAll(
      { modpackId: workshop.modpackId },
      { select: ["curseforgeProjectId"] },
    ),
    Q.workshop.mod.findAll(
      { workshopId: workshop.id },
      { select: ["curseforgeProjectId", "status"] },
    ),
    Q.workshop.project.dependency.findAll({
      workshopId: workshop.id,
      relationType: REQUIRED_DEPENDENCY,
    }),
  ]);

  const coverage = new Map<number, DependencyCoverage>();
  for (const row of suggestions) {
    coverage.set(row.curseforgeProjectId, COVERAGE_BY_STATUS[row.status]);
  }
  for (const row of packRows) {
    coverage.set(row.curseforgeProjectId, "published");
  }

  const wanters = new Map<number, Set<number>>();
  for (const edge of edges) {
    const subject = coverage.get(edge.curseforgeProjectId);
    if (subject !== "published" && subject !== "staged") continue;
    const set = wanters.get(edge.dependsOnProjectId) ?? new Set<number>();
    set.add(edge.curseforgeProjectId);
    wanters.set(edge.dependsOnProjectId, set);
  }
  const demand = new Map(
    [...wanters].map(([projectId, subjects]) => [projectId, subjects.size]),
  );

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
