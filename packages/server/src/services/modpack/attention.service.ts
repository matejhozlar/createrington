import { Q, db } from "@/db";
import { BadRequestError, ConflictError, NotFoundError } from "@/errors";
import type {
  CurseforgeProject,
  Modpack,
  ModpackMod,
  Workshop,
  WorkshopMod,
} from "@createrington/shared/db";
import type { ModpackManifest } from "@/services/curseforge/modpack";
import { getModpackManifest } from "@/services/modpack/manifest";
import {
  REQUIRED_DEPENDENCY,
  type DependencyCoverage,
} from "@createrington/shared/workshop";
import {
  loadDependencyContext,
  pruneStaleDependencyEdges,
} from "@/services/workshop/dependencies";
import { announceReview } from "@/services/workshop/discord";
import { recordModEvent } from "@/services/workshop/events";
import { modpackService } from "./modpack.service";
import { projectLabel } from "@/services/curseforge/project";

interface AttentionSubject {
  curseforgeProjectId: number;
  name: string;
  websiteUrl: string | null;
}

export interface ModpackDroppedMemberRemoval {
  member: ModpackMod;
  projectName: string;
  mod: WorkshopMod | null;
}

export type ModpackAttentionItem =
  | (AttentionSubject & {
      type: "dropped_from_pack";
      modpackModId: number;
      workshopModId: number | null;
      droppedAt: Date;
    })
  | (AttentionSubject & {
      type: "shipped_unreviewed";
      workshopModId: number;
    })
  | (AttentionSubject & {
      type: "shipped_rejected";
      workshopModId: number;
    })
  | (AttentionSubject & {
      type: "rejected_dependency" | "unpromoted_dependency";
      workshopModId: number;
      requiredBy: Array<{ curseforgeProjectId: number; name: string }>;
    })
  | (AttentionSubject & {
      type: "environment_unspecified";
      workshopModId: number | null;
    })
  | (AttentionSubject & {
      type: "duplicate_manifest_entry";
    });

interface DependencyGap {
  coverage: DependencyCoverage;
  requiredByProjectIds: number[];
}

type SubjectOf = (projectId: number) => AttentionSubject;

async function loadAttentionManifest(
  modpack: Modpack,
): Promise<ModpackManifest | null> {
  if (!modpack.curseforgeProjectId) return null;
  let manifest: ModpackManifest | null;
  try {
    manifest = await getModpackManifest(modpack.curseforgeProjectId);
  } catch (error) {
    logger.warn(
      `Modpack #${modpack.id} attention: manifest of CurseForge project #${modpack.curseforgeProjectId} could not be read, manifest checks skipped:`,
      error,
    );
    return null;
  }
  if (modpack.shipsServerPack && manifest?.serverPackFileId === null) {
    return null;
  }
  return manifest;
}

function shippedSuggestions(
  suggestions: WorkshopMod[],
  manifest: ModpackManifest | null,
): WorkshopMod[] {
  if (!manifest) return [];
  return suggestions.filter(
    (mod) =>
      manifest.modIds.has(mod.curseforgeProjectId) &&
      mod.status !== "next_update" &&
      mod.status !== "in_pack",
  );
}

function duplicateManifestProjects(
  manifest: ModpackManifest | null,
): Set<number> {
  const duplicates = new Set<number>();
  if (!manifest) return duplicates;
  const seen = new Set<number>();
  for (const entry of manifest.entries) {
    if (seen.has(entry.projectId)) duplicates.add(entry.projectId);
    seen.add(entry.projectId);
  }
  return duplicates;
}

function unclassifiedTargets(
  active: ModpackMod[],
  suggestions: WorkshopMod[],
): Map<number, number | null> {
  const targets = new Map<number, number | null>();
  for (const row of active) targets.set(row.curseforgeProjectId, null);
  for (const mod of suggestions) {
    if (mod.status !== "testing" && mod.status !== "next_update") continue;
    targets.set(mod.curseforgeProjectId, mod.id);
  }
  return targets;
}

async function dependencyGaps(
  workshop: Workshop,
  suggestionByProject: Map<number, WorkshopMod>,
): Promise<Map<number, DependencyGap>> {
  const context = await loadDependencyContext(workshop);
  const edges = await Q.workshop.project.dependency.findAll({
    workshopId: workshop.id,
    relationType: REQUIRED_DEPENDENCY,
  });
  const gaps = new Map<number, DependencyGap>();
  for (const edge of edges) {
    const coverage = context.coverage.get(edge.dependsOnProjectId) ?? "missing";
    if (coverage === "published" || coverage === "staged") continue;
    const subject = context.coverage.get(edge.curseforgeProjectId);
    const shipping = subject === "staged" || subject === "published";
    const status = suggestionByProject.get(edge.curseforgeProjectId)?.status;
    const qualifies =
      coverage === "rejected"
        ? shipping || status === "approved" || status === "testing"
        : shipping;
    if (!qualifies) continue;
    const gap = gaps.get(edge.dependsOnProjectId) ?? {
      coverage,
      requiredByProjectIds: [],
    };
    gap.requiredByProjectIds.push(edge.curseforgeProjectId);
    gaps.set(edge.dependsOnProjectId, gap);
  }
  return gaps;
}

function droppedItem(
  row: ModpackMod,
  subjectOf: SubjectOf,
): ModpackAttentionItem {
  return {
    type: "dropped_from_pack",
    modpackModId: row.id,
    workshopModId: row.workshopModId,
    ...subjectOf(row.curseforgeProjectId),
    droppedAt: row.droppedFromManifestAt!,
  };
}

function shippedItem(
  mod: WorkshopMod,
  subjectOf: SubjectOf,
): ModpackAttentionItem {
  return {
    type: mod.status === "rejected" ? "shipped_rejected" : "shipped_unreviewed",
    workshopModId: mod.id,
    ...subjectOf(mod.curseforgeProjectId),
  };
}

function dependencyGapItems(
  gaps: Map<number, DependencyGap>,
  suggestionByProject: Map<number, WorkshopMod>,
  subjectOf: SubjectOf,
): ModpackAttentionItem[] {
  return [...gaps].flatMap(([projectId, gap]): ModpackAttentionItem[] => {
    const suggestion = suggestionByProject.get(projectId);
    if (!suggestion) return [];
    return [
      {
        type:
          gap.coverage === "rejected"
            ? "rejected_dependency"
            : "unpromoted_dependency",
        workshopModId: suggestion.id,
        ...subjectOf(projectId),
        requiredBy: gap.requiredByProjectIds.map((id) => {
          const { curseforgeProjectId, name } = subjectOf(id);
          return { curseforgeProjectId, name };
        }),
      },
    ];
  });
}

function duplicateItem(
  projectId: number,
  subjectOf: SubjectOf,
): ModpackAttentionItem {
  return { type: "duplicate_manifest_entry", ...subjectOf(projectId) };
}

function environmentItems(
  targets: Map<number, number | null>,
  projectById: Map<number, CurseforgeProject>,
  subjectOf: SubjectOf,
): ModpackAttentionItem[] {
  return [...targets].flatMap(
    ([projectId, workshopModId]): ModpackAttentionItem[] =>
      projectById.get(projectId)?.environment === "unspecified"
        ? [
            {
              type: "environment_unspecified",
              workshopModId,
              ...subjectOf(projectId),
            },
          ]
        : [],
  );
}

/**
 * What a workshop's modpack needs an admin to decide: members the latest
 * publish dropped, shipped suggestions nobody reviewed, dependency gaps,
 * duplicate manifest entries and unclassified environments, plus resolving
 * a dropped member.
 */
export class ModpackAttentionService {
  /** Items needing an admin decision for a workshop's modpack. */
  async getWorkshopAttention(
    workshop: Workshop,
  ): Promise<ModpackAttentionItem[]> {
    const modpack = await modpackService.getModpack(workshop.modpackId);
    const rows = await Q.modpack.mod.findAll({ modpackId: modpack.id });
    const dropped = rows.filter((row) => row.droppedFromManifestAt !== null);
    const active = rows.filter((row) => row.droppedFromManifestAt === null);
    const manifest = await loadAttentionManifest(modpack);
    const suggestions = await Q.workshop.mod.findAll({
      workshopId: workshop.id,
    });
    const suggestionByProject = new Map(
      suggestions.map((mod) => [mod.curseforgeProjectId, mod]),
    );

    const shipped = shippedSuggestions(suggestions, manifest);
    const duplicateIds = duplicateManifestProjects(manifest);
    const gaps = await dependencyGaps(workshop, suggestionByProject);
    const unclassified = unclassifiedTargets(active, suggestions);

    const projectIds = [
      ...new Set([
        ...dropped.map((row) => row.curseforgeProjectId),
        ...unclassified.keys(),
        ...shipped.map((mod) => mod.curseforgeProjectId),
        ...duplicateIds,
        ...[...gaps].flatMap(([depId, gap]) => [
          depId,
          ...gap.requiredByProjectIds,
        ]),
      ]),
    ];
    const projects =
      projectIds.length > 0
        ? await Q.curseforge.project.findAll({ id: { $in: projectIds } })
        : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const subjectOf: SubjectOf = (id) => {
      const project = projectById.get(id);
      return {
        curseforgeProjectId: id,
        name: projectLabel(project?.name, id),
        websiteUrl: project?.websiteUrl ?? null,
      };
    };

    return [
      ...dropped.map((row) => droppedItem(row, subjectOf)),
      ...shipped.map((mod) => shippedItem(mod, subjectOf)),
      ...dependencyGapItems(gaps, suggestionByProject, subjectOf),
      ...[...duplicateIds].map((id) => duplicateItem(id, subjectOf)),
      ...environmentItems(unclassified, projectById, subjectOf),
    ];
  }

  /**
   * Resolve a dropped_from_pack item: delete the member row and rule out the
   * suggestion behind it, even one from a sibling workshop of the same pack,
   * since a next_update entry anywhere would ship the mod again. Live members
   * and archived workshops on either side are refused.
   */
  async removeDroppedMember(
    workshop: Workshop,
    modpackModId: number,
    adminId: string,
  ): Promise<ModpackDroppedMemberRemoval> {
    if (workshop.status === "archived") {
      throw new BadRequestError(
        "Cannot resolve pack issues in an archived workshop",
      );
    }
    const member = await Q.modpack.mod.find({ id: modpackModId });
    if (!member || member.modpackId !== workshop.modpackId) {
      throw new NotFoundError(
        `Pack member #${modpackModId} not found in this workshop's pack`,
      );
    }
    if (member.droppedFromManifestAt === null) {
      throw new BadRequestError(
        "This mod is still in the published pack, publish a release without it first",
      );
    }
    const [project, mod] = await Promise.all([
      Q.curseforge.project.find({ id: member.curseforgeProjectId }),
      member.workshopModId
        ? Q.workshop.mod.find({ id: member.workshopModId })
        : Promise.resolve(null),
    ]);
    const toReject = mod && mod.status !== "rejected" ? mod : null;
    if (toReject && toReject.workshopId !== workshop.id) {
      const owner = await Q.workshop.find({ id: toReject.workshopId });
      if (owner?.status === "archived") {
        throw new BadRequestError(
          "The suggestion behind this mod belongs to an archived workshop, so it cannot be ruled out from here",
        );
      }
    }
    const now = new Date();

    await db.inTransaction(async (tx) => {
      const deleted = await tx.modpack.mod.deleteAll({
        id: member.id,
        droppedFromManifestAt: { $ne: null },
      });
      if (deleted === 0) {
        throw new ConflictError(
          "This pack member just changed, refresh and try again",
        );
      }
      if (!toReject) return;
      const changed = await tx.workshop.mod.updateAll(
        {
          status: "rejected",
          rejectReason: null,
          rejectNote: null,
          reviewedBy: adminId,
          reviewedAt: now,
          ...(toReject.status === "next_update" ? { fileChosen: false } : {}),
        },
        { id: toReject.id, status: toReject.status },
      );
      if (changed === 0) {
        throw new ConflictError(
          "This mod was just reviewed by someone else, refresh and try again",
        );
      }
    });

    let updated = mod;
    if (toReject) {
      updated = await Q.workshop.mod.get({ id: toReject.id });
      recordModEvent({
        eventType: "rejected",
        workshopId: toReject.workshopId,
        workshopModId: toReject.id,
        curseforgeProjectId: toReject.curseforgeProjectId,
        actorDiscordId: adminId,
        fromStatus: toReject.status,
        toStatus: "rejected",
      });
      void announceReview(updated, "rejected");
    }
    const workshops = await Q.workshop.findAll({ modpackId: member.modpackId });
    await Promise.all(workshops.map((row) => pruneStaleDependencyEdges(row)));
    return {
      member,
      projectName: projectLabel(project?.name, member.curseforgeProjectId),
      mod: updated,
    };
  }
}

export const modpackAttentionService = new ModpackAttentionService();
