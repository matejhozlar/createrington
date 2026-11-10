import { db, Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import type {
  CurseforgeProject,
  ModEnvironment,
  Workshop,
  WorkshopMod,
  WorkshopModRejectReason,
  WorkshopModStatus,
} from "@createrington/shared/db";
import {
  hasRuledOutRequiredDependency,
  WORKSHOP_MOD_REVIEW_ACTION_LABELS,
  WORKSHOP_MOD_REVIEW_TARGETS,
  WORKSHOP_MOD_STATUS_LABELS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";
import {
  getFilesDetails,
  type CurseForgeFileDetail,
} from "@/services/curseforge/files";
import { announceReview, announceSuggestion } from "./discord";
import {
  loadDependencyContext,
  pruneStaleDependencyEdges,
  resolveProjectDependencies,
  tryResolveProjectDependencies,
} from "./dependencies";
import { recordModEvent, REVIEW_EVENT_TYPES } from "./events";
import {
  addableClasses,
  createMods,
  mapConstraintError,
  prepareEntries,
} from "./entries";
import { workshopModService, type WorkshopModListItem } from "./mods.service";
import { workshopService } from "./workshop.service";

export type WorkshopReviewAction = WorkshopModReviewAction;

/**
 * Admin curation of suggestions: moving a mod through the review pipeline,
 * adding mods on the team's behalf, and the per-mod choices made while a mod
 * waits for the next update (environment, enabled flag, file).
 */
export class WorkshopReviewService {
  /**
   * Move a mod through the review pipeline. WORKSHOP_MOD_REVIEW_TARGETS is the
   * rule: a status with no entry for the action is refused. A mod that is
   * in_pack is live in the published pack, so no review action applies to it:
   * it has to be dropped from a published release first, which reconcile turns
   * into a move back to next_update. Repeating an action the mod already
   * satisfies is an idempotent no-op; a reject with a changed reason or note
   * is an edit, not a repeat. The in_pack status is reconcile-owned and never
   * set here.
   */
  async reviewMod(
    workshopModId: number,
    action: WorkshopReviewAction,
    adminId: string,
    options: {
      reason?: WorkshopModRejectReason;
      note?: string;
      allowedFrom?: WorkshopModStatus[];
    } = {},
  ): Promise<WorkshopMod> {
    if (action === "reject" && !options.reason) {
      throw new BadRequestError("A reason is required to reject a mod");
    }
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod) throw new NotFoundError(`Mod #${workshopModId} not found`);

    const workshop = await workshopService.getWorkshop(mod.workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError("Cannot review mods in an archived workshop");
    }
    if (options.allowedFrom && !options.allowedFrom.includes(mod.status)) {
      throw new BadRequestError(
        `Mods that are ${WORKSHOP_MOD_STATUS_LABELS[mod.status].toLowerCase()} cannot be reviewed from here, use the main admin page`,
      );
    }

    if (
      action === "approve" &&
      (mod.status === "approved" ||
        mod.status === "next_update" ||
        mod.status === "in_pack")
    ) {
      return mod;
    }
    if (action === "start_testing" && mod.status === "testing") return mod;
    if (
      action === "reject" &&
      mod.status === "rejected" &&
      mod.rejectReason === options.reason &&
      mod.rejectNote === (options.note?.trim() || null)
    ) {
      return mod;
    }
    const target = WORKSHOP_MOD_REVIEW_TARGETS[mod.status][action];
    if (!target) {
      throw new BadRequestError(
        mod.status === "in_pack"
          ? "This mod is live in the published pack, publish a release without it first"
          : `Cannot ${WORKSHOP_MOD_REVIEW_ACTION_LABELS[action]} a mod that is ${WORKSHOP_MOD_STATUS_LABELS[
              mod.status
            ].toLowerCase()}`,
      );
    }

    // Keyed on the action, not the target: send_back from next_update also
    // lands on testing and must stay open as an escape hatch
    if (action === "start_testing") {
      await this.assertNoRuledOutRequiredDependency(workshop, mod);
    }

    if (target === "next_update") {
      const project = await Q.curseforge.project.find({
        id: mod.curseforgeProjectId,
      });
      if (!project || project.environment === "unspecified") {
        throw new BadRequestError(
          "Flag whether this mod runs client or server side before approving it for the next update",
        );
      }
    }

    const fileChosenReset =
      mod.status === "next_update" ? { fileChosen: false } : {};
    const changed = await Q.workshop.mod.updateAll(
      target === "rejected"
        ? {
            status: "rejected",
            rejectReason: options.reason,
            rejectNote: options.note?.trim() || null,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            ...fileChosenReset,
          }
        : {
            status: target,
            rejectReason: null,
            rejectNote: null,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            ...fileChosenReset,
          },
      { id: workshopModId, status: mod.status },
    );
    if (changed === 0) {
      throw new ConflictError(
        "This mod was just reviewed by someone else, refresh and try again",
      );
    }
    const updated = await Q.workshop.mod.get({ id: workshopModId });

    recordModEvent({
      eventType: REVIEW_EVENT_TYPES[action],
      workshopId: mod.workshopId,
      workshopModId: mod.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      actorDiscordId: adminId,
      fromStatus: mod.status,
      toStatus: updated.status,
      rejectReason: updated.rejectReason,
      note: updated.rejectNote,
    });
    void announceReview(updated, target);
    if (target === "rejected") await pruneStaleDependencyEdges(workshop);
    // Rejecting pruned this mod's own edges; un-rejecting has to bring them
    // back itself, since the daily sweep skips closed workshops
    if (mod.status === "rejected" && target !== "rejected") {
      void tryResolveProjectDependencies(workshop, [updated]);
    }
    return updated;
  }

  private async assertNoRuledOutRequiredDependency(
    workshop: Workshop,
    mod: WorkshopMod,
  ): Promise<void> {
    let edges = await Q.workshop.project.dependency.findAll({
      workshopId: workshop.id,
      curseforgeProjectId: mod.curseforgeProjectId,
    });
    // An empty cache can mean resolution silently failed, so re-resolve
    // before trusting it; mods without a chosen file have nothing to resolve
    if (edges.length === 0 && mod.fileId !== null) {
      try {
        await resolveProjectDependencies(workshop, [mod]);
      } catch (error) {
        logger.warn(
          `Dependency check failed for workshop mod #${mod.id}:`,
          error,
        );
        throw new BadRequestError(
          "Could not check this mod's dependencies right now, please try again",
        );
      }
      edges = await Q.workshop.project.dependency.findAll({
        workshopId: workshop.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      });
    }
    if (edges.length === 0) return;

    const { coverage } = await loadDependencyContext(
      workshop,
      edges.map((edge) => edge.dependsOnProjectId),
    );
    const blocked = hasRuledOutRequiredDependency(
      edges.map((edge) => ({
        relationType: edge.relationType,
        coverage: coverage.get(edge.dependsOnProjectId) ?? "missing",
      })),
    );
    if (blocked) {
      throw new BadRequestError(
        "A required dependency of this mod has been ruled out for this workshop",
      );
    }
  }

  /**
   * Add mods on the team's behalf. They enter as ordinary suggestions credited
   * to the acting admin and already approved, so they still walk testing and
   * next_update before reaching the pack. Unlike user suggestions, admin adds
   * also take the extra addable classes, such as resource packs.
   *
   * Unlike suggesting, this works on draft and closed workshops. Threads are
   * only ever posted for open ones: a draft workshop's adds pick theirs up from
   * the daily sweep once it opens, a closed workshop's never get one.
   */
  async addModsAsAdmin(
    workshopId: number,
    projectIds: number[],
    adminId: string,
    note?: string,
  ): Promise<WorkshopModListItem[]> {
    const workshop = await workshopService.getWorkshop(workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError("Cannot add mods to an archived workshop");
    }
    const prepared = await prepareEntries(
      workshop,
      projectIds.map((projectId) => ({ projectId, note })),
      addableClasses(workshop),
    );

    let created: WorkshopMod[];
    try {
      created = await db.inTransaction(async (tx) => {
        const mods = await createMods(tx, workshop, prepared, {
          submittedBy: adminId,
          status: "approved",
          reviewedBy: adminId,
        });
        await tx.workshop.mod.upvote.createMany(
          mods.map((mod) => ({ workshopModId: mod.id, discordId: adminId })),
        );
        return mods;
      });
    } catch (error) {
      mapConstraintError(error);
    }

    for (const mod of created) {
      recordModEvent({
        eventType: "suggested",
        workshopId: workshop.id,
        workshopModId: mod.id,
        curseforgeProjectId: mod.curseforgeProjectId,
        actorDiscordId: adminId,
        toStatus: mod.status,
        note: mod.note,
      });
    }
    const items = await workshopModService.decorateMods(workshop, created);
    void (async () => {
      for (const item of items) await announceSuggestion(workshop, item);
      await tryResolveProjectDependencies(workshop, created);
    })();
    return items;
  }

  /**
   * Flag which side(s) a project runs on. Explicit sides become manual flags
   * that neither CurseForge hints nor the published pack overwrite;
   * unspecified clears the flag so the next snapshot refresh may re-apply a
   * CurseForge hint.
   */
  async setProjectEnvironment(
    curseforgeProjectId: number,
    environment: ModEnvironment,
  ): Promise<CurseforgeProject> {
    const project = await Q.curseforge.project.find({
      id: curseforgeProjectId,
    });
    if (!project) {
      throw new NotFoundError(
        `CurseForge project #${curseforgeProjectId} is not cached`,
      );
    }
    return Q.curseforge.project.updateAndReturn(
      { id: curseforgeProjectId },
      {
        environment,
        environmentSource: environment === "unspecified" ? null : "manual",
      },
    );
  }

  /**
   * Choose whether a mod waiting for the next update ships enabled or
   * disabled (manifest required flag). The flag is intent while the mod sits
   * in next_update, so only that status can set it: once the mod ships the
   * published manifest owns it, and a mod that later drops back out of the
   * pack returns to next_update with the flag reset to what the pack last
   * published. Throws ConflictError when a concurrent review moved the mod
   * between the status check and the write.
   */
  async setModRequired(
    workshopModId: number,
    required: boolean,
  ): Promise<{ mod: WorkshopMod; changed: boolean }> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod)
      throw new NotFoundError(`Workshop mod #${workshopModId} not found`);
    if (mod.status !== "next_update") {
      throw new BadRequestError(
        "Only mods waiting for the next update can be enabled or disabled",
      );
    }
    const workshop = await workshopService.getWorkshop(mod.workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError(
        "Cannot enable or disable mods in an archived workshop",
      );
    }
    if (mod.required === required) return { mod, changed: false };
    const claimed = await Q.workshop.mod.updateAll(
      { required },
      { id: workshopModId, status: "next_update" },
    );
    if (claimed === 0) {
      throw new ConflictError(
        "This mod left the next update while it was being changed",
      );
    }
    return { mod: { ...mod, required }, changed: true };
  }

  /**
   * Choose which CurseForge file a mod waiting for the next update ships,
   * or reset the choice with a null fileId so builds pick the newest
   * matching file again. The choice is intent while the mod sits in
   * next_update, so only that status can set it, and any move out of
   * next_update clears it. Picking the mod's current file only flips the
   * mark; a new file is validated for ownership and the dependency edges
   * are re-resolved from it before returning. Validation stops at
   * ownership on purpose: file details carry no game versions, and listing
   * files by game version does not paginate, so a compatibility gate here
   * would falsely reject old files; the sandbox picker only offers
   * matching files. Throws ConflictError when a concurrent review moved
   * the mod between the status check and the write.
   */
  async setModFile(
    workshopModId: number,
    fileId: number | null,
  ): Promise<{ mod: WorkshopMod; changed: boolean }> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod)
      throw new NotFoundError(`Workshop mod #${workshopModId} not found`);
    if (mod.status !== "next_update") {
      throw new BadRequestError(
        "Only mods waiting for the next update can have their file chosen",
      );
    }
    const workshop = await workshopService.getWorkshop(mod.workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError("Cannot choose files in an archived workshop");
    }

    if (fileId === null) {
      if (!mod.fileChosen) return { mod, changed: false };
      const claimed = await Q.workshop.mod.updateAll(
        { fileChosen: false },
        { id: workshopModId, status: "next_update" },
      );
      if (claimed === 0) {
        throw new ConflictError(
          "This mod left the next update while it was being changed",
        );
      }
      return { mod: { ...mod, fileChosen: false }, changed: true };
    }

    if (mod.fileId === fileId) {
      if (mod.fileChosen) return { mod, changed: false };
      const claimed = await Q.workshop.mod.updateAll(
        { fileChosen: true },
        { id: workshopModId, status: "next_update" },
      );
      if (claimed === 0) {
        throw new ConflictError(
          "This mod left the next update while it was being changed",
        );
      }
      return { mod: { ...mod, fileChosen: true }, changed: true };
    }

    let details: CurseForgeFileDetail[];
    try {
      details = await getFilesDetails([fileId]);
    } catch (error) {
      logger.warn(`File lookup failed for workshop mod #${mod.id}:`, error);
      throw new BadRequestError(
        "Could not verify the file with CurseForge right now, please try again",
      );
    }
    const detail = details.find((d) => d.fileId === fileId);
    if (!detail || detail.projectId !== mod.curseforgeProjectId) {
      throw new BadRequestError(
        "This is not a CurseForge file of this mod's project",
      );
    }

    const update = {
      fileId: detail.fileId,
      fileName: detail.fileName ?? detail.displayName,
      fileReleaseType: detail.releaseType,
      fileChosen: true,
    };
    const claimed = await Q.workshop.mod.updateAll(update, {
      id: workshopModId,
      status: "next_update",
    });
    if (claimed === 0) {
      throw new ConflictError(
        "This mod left the next update while it was being changed",
      );
    }
    await tryResolveProjectDependencies(workshop, [
      { curseforgeProjectId: mod.curseforgeProjectId, fileId: detail.fileId },
    ]);
    return { mod: { ...mod, ...update }, changed: true };
  }
}

export const workshopReviewService = new WorkshopReviewService();
