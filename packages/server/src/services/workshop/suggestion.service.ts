import { db, Q } from "@/db";
import { BadRequestError, NotFoundError } from "@/app/middleware/error-handler";
import { UniqueViolationError } from "@/db/utils/errors";
import type { Workshop, WorkshopMod } from "@createrington/shared/db";
import { LOADERLESS_CLASSES, searchMods } from "@/services/curseforge/mods";
import { assertCanSuggest } from "./bans";
import { announceRemoval, announceSuggestion } from "./discord";
import { tryResolveProjectDependencies } from "./dependencies";
import { recordModEvent } from "./events";
import {
  addableClasses,
  createMod,
  mapConstraintError,
  prepareEntries,
  type TxQueries,
  type WorkshopModEntry,
} from "./entries";
import { workshopModService, type WorkshopModListItem } from "./mods.service";
import { USER_VISIBLE_MOD_STATUSES, workshopService } from "./workshop.service";

export interface WorkshopProjectSearchResult {
  id: number;
  name: string;
  slug: string;
  url: string;
  thumbnailUrl?: string;
  summary: string | null;
  primaryAuthor: string | null;
  downloadCount: number;
  inModpack: boolean;
  rejected: boolean;
  claimed: boolean;
}

/**
 * What players do in an open workshop: search CurseForge for a project,
 * suggest it against their per-workshop slot cap, withdraw a pending
 * suggestion, and spend their upvote budget.
 */
export class WorkshopSuggestionService {
  /**
   * CurseForge search scoped to the workshop's target, annotated with submit
   * guards. User-visible searches require an open workshop, since search
   * exists to feed suggestions and proxies the live API. Admin searches may
   * target another addable class, such as resource packs.
   */
  async searchProjects(
    workshopId: number,
    query: string,
    options: { userVisible?: boolean; classId?: number } = {},
  ): Promise<WorkshopProjectSearchResult[]> {
    const workshop = options.userVisible
      ? await workshopService.getOpenWorkshop(workshopId)
      : await workshopService.getWorkshop(workshopId);
    const classId = options.userVisible
      ? workshop.classId
      : (options.classId ?? workshop.classId);
    if (!addableClasses(workshop).has(classId)) {
      throw new BadRequestError(
        "That project type cannot be added to this workshop",
      );
    }
    const results = await searchMods(query, 20, {
      gameVersion: workshop.gameVersion,
      modLoaderType: LOADERLESS_CLASSES.has(classId)
        ? null
        : workshop.modLoaderType,
      classId,
      packProjectId: workshop.baseModpackProjectId ?? null,
    });
    if (results.length === 0) return [];

    const ids = results.map((r) => r.id);
    const [claims, packClaims] = await Promise.all([
      Q.workshop.mod.findAll({
        workshopId: workshop.id,
        curseforgeProjectId: { $in: ids },
      }),
      Q.modpack.mod.findAll({
        modpackId: workshop.modpackId,
        curseforgeProjectId: { $in: ids },
      }),
    ]);
    const rejectedIds = new Set(
      claims
        .filter((c) => c.status === "rejected")
        .map((c) => c.curseforgeProjectId),
    );
    const claimedIds = new Set([
      ...claims
        .filter((c) => c.status !== "rejected")
        .map((c) => c.curseforgeProjectId),
      ...packClaims.map((c) => c.curseforgeProjectId),
    ]);

    return results.map((r) => ({
      ...r,
      rejected: rejectedIds.has(r.id),
      claimed: claimedIds.has(r.id),
    }));
  }

  /**
   * Suggest a single mod, consuming one of the caller's per-workshop slots.
   * Only pending suggestions count against the cap. The suggestion starts
   * with the caller's own upvote.
   */
  async suggestMod(
    workshopId: number,
    discordId: string,
    entry: WorkshopModEntry,
  ): Promise<WorkshopModListItem> {
    const workshop = await workshopService.getOpenWorkshop(workshopId);
    await assertCanSuggest(discordId, workshop.id);
    await this.assertSuggestionSlot(Q, workshop, discordId);

    const [prepared] = await prepareEntries(workshop, [entry]);

    let created: WorkshopMod;
    try {
      created = await db.inTransaction(async (tx) => {
        await tx.workshop.lockUserBudget(workshop.id, discordId);
        await this.assertSuggestionSlot(tx, workshop, discordId);
        const mod = await createMod(tx, workshop, prepared, {
          submittedBy: discordId,
        });
        await tx.workshop.mod.upvote.create({
          workshopModId: mod.id,
          discordId,
        });
        return mod;
      });
    } catch (error) {
      mapConstraintError(error);
    }

    recordModEvent({
      eventType: "suggested",
      workshopId: workshop.id,
      workshopModId: created.id,
      curseforgeProjectId: created.curseforgeProjectId,
      actorDiscordId: discordId,
      toStatus: created.status,
      note: created.note,
    });
    const [item] = await workshopModService.decorateMods(workshop, [created]);
    if (!item) throw new NotFoundError(`Mod #${created.id} not found`);
    void announceSuggestion(workshop, item);
    void tryResolveProjectDependencies(workshop, [created]);
    return item;
  }

  /** Remove the caller's own pending suggestion, freeing a slot. */
  async removeSuggestion(
    workshopModId: number,
    discordId: string,
  ): Promise<void> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod || mod.submittedBy !== discordId) {
      throw new NotFoundError(`Suggestion #${workshopModId} not found`);
    }
    await workshopService.getOpenWorkshop(mod.workshopId);
    if (mod.status !== "pending") {
      throw new BadRequestError("Only pending suggestions can be removed");
    }
    const removed = await Q.workshop.mod.deleteAll({
      id: workshopModId,
      status: "pending",
    });
    if (removed === 0) {
      throw new BadRequestError("Only pending suggestions can be removed");
    }
    recordModEvent({
      eventType: "withdrawn",
      workshopId: mod.workshopId,
      workshopModId: mod.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      actorDiscordId: discordId,
      fromStatus: mod.status,
    });
    void announceRemoval(mod);
  }

  /**
   * Toggle the caller's upvote on a visible mod in an open workshop. Upvotes on
   * other players' pending mods draw from the per-workshop budget; a review
   * refunds them. Upvotes on reviewed mods and on the caller's own suggestions
   * are free.
   */
  async toggleModUpvote(
    workshopModId: number,
    discordId: string,
  ): Promise<{
    upvoted: boolean;
    upvoteCount: number;
    votesRemaining: number;
  }> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod || !USER_VISIBLE_MOD_STATUSES.includes(mod.status)) {
      throw new NotFoundError(`Mod #${workshopModId} not found`);
    }
    const workshop = await workshopService.getOpenWorkshop(mod.workshopId);

    const existing = await Q.workshop.mod.upvote.find({
      workshopModId,
      discordId,
    });
    let upvoted: boolean;
    if (existing) {
      await Q.workshop.mod.upvote.deleteAll({ id: existing.id });
      upvoted = false;
    } else {
      try {
        await db.inTransaction(async (tx) => {
          await tx.workshop.lockUserBudget(workshop.id, discordId);
          const fresh = await tx.workshop.mod.find({ id: workshopModId });
          if (!fresh || !USER_VISIBLE_MOD_STATUSES.includes(fresh.status)) {
            throw new NotFoundError(`Mod #${workshopModId} not found`);
          }
          if (fresh.status === "pending" && fresh.submittedBy !== discordId) {
            const used = await tx.workshop.mod.upvote.countPendingByUser(
              workshop.id,
              discordId,
            );
            if (used >= workshop.maxUpvotesPerUser) {
              throw new BadRequestError(
                `You have used all ${workshop.maxUpvotesPerUser} of your votes, remove one or wait for a review`,
              );
            }
          }
          await tx.workshop.mod.upvote.create({ workshopModId, discordId });
        });
      } catch (error) {
        const duplicateUpvote =
          error instanceof UniqueViolationError &&
          error.constraint === "idx_workshop_mod_upvote_unique";
        if (!duplicateUpvote) throw error;
      }
      upvoted = true;
    }

    const [upvoteCount, used] = await Promise.all([
      Q.workshop.mod.upvote.count({ workshopModId }),
      Q.workshop.mod.upvote.countPendingByUser(workshop.id, discordId),
    ]);
    return {
      upvoted,
      upvoteCount,
      votesRemaining: Math.max(0, workshop.maxUpvotesPerUser - used),
    };
  }

  /** IDs of the mods in a workshop the caller has upvoted, plus their workshop budget. */
  async getMyUpvotes(
    workshopId: number,
    discordId: string,
  ): Promise<{ modIds: number[]; maxUpvotes: number; votesRemaining: number }> {
    const workshop = await workshopService.getWorkshop(workshopId);
    workshopService.assertUserVisible(workshop);
    const [modIds, used] = await Promise.all([
      Q.workshop.mod.upvote.getModIdsByUser(workshopId, discordId),
      Q.workshop.mod.upvote.countPendingByUser(workshopId, discordId),
    ]);

    return {
      modIds,
      maxUpvotes: workshop.maxUpvotesPerUser,
      votesRemaining: Math.max(0, workshop.maxUpvotesPerUser - used),
    };
  }

  private async assertSuggestionSlot(
    queries: Pick<TxQueries, "workshop">,
    workshop: Workshop,
    discordId: string,
  ): Promise<void> {
    const used = await queries.workshop.mod.count({
      workshopId: workshop.id,
      submittedBy: discordId,
      status: "pending",
    });
    if (used >= workshop.maxModsPerUser) {
      throw new BadRequestError(
        `You already have ${workshop.maxModsPerUser} pending suggestions in this workshop, remove one or wait for a review`,
      );
    }
  }
}

export const workshopSuggestionService = new WorkshopSuggestionService();
