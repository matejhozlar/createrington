import { Q, db } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import type {
  ModpackMod,
  Workshop,
  WorkshopMod,
} from "@createrington/shared/db";
import type { ModpackManifest } from "@/services/curseforge/modpack";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
import {
  REQUIRED_DEPENDENCY,
  loadDependencyContext,
  pruneStaleDependencyEdges,
  type DependencyCoverage,
} from "@/services/workshop/dependencies";
import { announceReview } from "@/services/workshop/discord";
import { recordModEvent } from "@/services/workshop/events";
import { modpackService } from "./modpack.service";

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
    const items: ModpackAttentionItem[] = [];

    const rows = await Q.modpack.mod.findAll({ modpackId: modpack.id });
    const dropped = rows.filter((row) => row.droppedFromManifestAt !== null);
    const active = rows.filter((row) => row.droppedFromManifestAt === null);

    let manifest: ModpackManifest | null = null;
    if (modpack.curseforgeProjectId) {
      try {
        manifest = await getModpackManifest(modpack.curseforgeProjectId);
      } catch {
        manifest = null;
      }
      if (modpack.shipsServerPack && manifest?.serverPackFileId === null) {
        manifest = null;
      }
    }

    const suggestions = await Q.workshop.mod.findAll({
      workshopId: workshop.id,
    });

    let shipped: WorkshopMod[] = [];
    const duplicateIds = new Set<number>();
    if (manifest) {
      const { modIds } = manifest;
      shipped = suggestions.filter(
        (mod) =>
          modIds.has(mod.curseforgeProjectId) &&
          mod.status !== "next_update" &&
          mod.status !== "in_pack",
      );
      const seen = new Set<number>();
      for (const entry of manifest.entries) {
        if (seen.has(entry.projectId)) duplicateIds.add(entry.projectId);
        seen.add(entry.projectId);
      }
    }

    // A dependency is only a problem for something that ships, so the gaps are
    // read off the mods staged for the next update and the ones already in
    const context = await loadDependencyContext(workshop);
    const edges = await Q.workshop.project.dependency.findAll({
      workshopId: workshop.id,
      relationType: REQUIRED_DEPENDENCY,
    });
    const suggestionByProject = new Map(
      suggestions.map((mod) => [mod.curseforgeProjectId, mod]),
    );
    // A project can be both a pack member and a live suggestion; the
    // suggestion wins so the item can link through to the mod
    const unclassifiedTargets = new Map<number, number | null>();
    for (const row of active) {
      unclassifiedTargets.set(row.curseforgeProjectId, null);
    }
    for (const mod of suggestions) {
      if (mod.status !== "testing" && mod.status !== "next_update") continue;
      unclassifiedTargets.set(mod.curseforgeProjectId, mod.id);
    }
    const gaps = new Map<
      number,
      { coverage: DependencyCoverage; requiredByProjectIds: number[] }
    >();
    for (const edge of edges) {
      const coverage =
        context.coverage.get(edge.dependsOnProjectId) ?? "missing";
      if (coverage === "published" || coverage === "staged") continue;
      const subject = context.coverage.get(edge.curseforgeProjectId);
      const shipping = subject === "staged" || subject === "published";
      // A ruled-out dependency also blocks mods still walking review, so
      // approved and testing subjects surface for that case; other gap kinds
      // only matter for shipping mods
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

    const projectIds = [
      ...new Set([
        ...dropped.map((row) => row.curseforgeProjectId),
        ...unclassifiedTargets.keys(),
        ...shipped.map((mod) => mod.curseforgeProjectId),
        ...duplicateIds,
        ...[...gaps.entries()].flatMap(([depId, gap]) => [
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
    const label = (id: number) => projectById.get(id)?.name ?? `#${id}`;
    const attentionSubject = (id: number): AttentionSubject => {
      const project = projectById.get(id);
      return {
        curseforgeProjectId: id,
        name: project?.name ?? `#${id}`,
        websiteUrl: project?.websiteUrl ?? null,
      };
    };

    for (const row of dropped) {
      items.push({
        type: "dropped_from_pack",
        modpackModId: row.id,
        workshopModId: row.workshopModId,
        ...attentionSubject(row.curseforgeProjectId),
        droppedAt: row.droppedFromManifestAt!,
      });
    }
    for (const mod of shipped) {
      items.push({
        type:
          mod.status === "rejected" ? "shipped_rejected" : "shipped_unreviewed",
        workshopModId: mod.id,
        ...attentionSubject(mod.curseforgeProjectId),
      });
    }
    for (const [projectId, gap] of gaps) {
      const suggestion = suggestionByProject.get(projectId);
      if (!suggestion) continue;
      items.push({
        type:
          gap.coverage === "rejected"
            ? "rejected_dependency"
            : "unpromoted_dependency",
        workshopModId: suggestion.id,
        ...attentionSubject(projectId),
        requiredBy: gap.requiredByProjectIds.map((id) => ({
          curseforgeProjectId: id,
          name: label(id),
        })),
      });
    }
    for (const projectId of duplicateIds) {
      items.push({
        type: "duplicate_manifest_entry",
        ...attentionSubject(projectId),
      });
    }
    for (const [projectId, workshopModId] of unclassifiedTargets) {
      const project = projectById.get(projectId);
      if (project?.environment !== "unspecified") continue;
      items.push({
        type: "environment_unspecified",
        workshopModId,
        ...attentionSubject(projectId),
      });
    }
    return items;
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
      projectName: project?.name ?? `#${member.curseforgeProjectId}`,
      mod: updated,
    };
  }
}

export const modpackAttentionService = new ModpackAttentionService();
