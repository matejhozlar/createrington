import { db, Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { ConstraintViolationError, DatabaseError } from "@/db/utils/errors";
import type {
  CurseforgeProject,
  ModEnvironment,
  Workshop,
  WorkshopMod,
  WorkshopModRejectReason,
  WorkshopModStatus,
  WorkshopProjectDependency,
} from "@createrington/shared/db";
import {
  hasRuledOutRequiredDependency,
  WORKSHOP_MOD_REVIEW_ACTION_LABELS,
  WORKSHOP_MOD_REVIEW_TARGETS,
  WORKSHOP_MOD_STATUS_LABELS,
  WORKSHOP_STATUS_TRANSITIONS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";
import {
  CurseForgeClass,
  getMod,
  getModpackModIds,
  searchMods,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { ingestProjects } from "@/services/curseforge/ingest";
import { modpackService } from "@/services/modpack";
import type { ModpackModListItem } from "@/services/modpack";
import { assertCanSuggest } from "./bans";
import {
  announceRemoval,
  announceReview,
  announceSuggestion,
  assertForumChannel,
  discordThreadUrl,
} from "./discord";
import {
  loadDependencyContext,
  pruneStaleDependencyEdges,
  resolveProjectDependencies,
  tryResolveProjectDependencies,
  REQUIRED_DEPENDENCY,
  type DependencyCoverage,
} from "./dependencies";
import { recordModEvent, REVIEW_EVENT_TYPES } from "./events";

export type WorkshopProjectSummary = Pick<
  CurseforgeProject,
  | "id"
  | "name"
  | "slug"
  | "summary"
  | "thumbnailUrl"
  | "websiteUrl"
  | "primaryAuthor"
  | "categories"
  | "downloadCount"
  | "dateReleased"
  | "allowModDistribution"
  | "environment"
  | "environmentSource"
>;

export interface WorkshopModDependencyInfo {
  curseforgeProjectId: number;
  relationType: number;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  coverage: DependencyCoverage;
  requiredByCount: number;
}

export interface WorkshopModListItem extends WorkshopMod {
  project: WorkshopProjectSummary;
  upvoteCount: number;
  submitterName: string | null;
  discordThreadUrl: string | null;
  dependencies: WorkshopModDependencyInfo[];
  liveInVersion: string | null;
}

export interface WorkshopDependencyListItem {
  curseforgeProjectId: number;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  coverage: DependencyCoverage;
  requiredBy: Array<{ curseforgeProjectId: number; name: string }>;
  optionalByCount: number;
  shippingDemand: number;
}

export type WorkshopSuggestionHistoryItem = WorkshopModListItem & {
  workshopName: string;
  workshopSlug: string;
};

export interface WorkshopPackView {
  modpack: {
    name: string;
    description: string | null;
    curseforgeUrl: string | null;
  };
  mods: ModpackModListItem[];
}

export interface WorkshopModEntry {
  projectId: number;
  note?: string;
}

export interface WorkshopParticipantSample {
  minecraftUuid: string;
  minecraftUsername: string;
}

export interface WorkshopTopMod {
  workshopModId: number;
  name: string;
  primaryAuthor: string | null;
  upvoteCount: number;
  thumbnailUrl: string | null;
}

const PACK_SAMPLE_SIZE = 4;

export interface WorkshopPackSampleMod {
  id: number;
  name: string;
  thumbnailUrl: string | null;
}

export interface WorkshopSummary {
  packModCount: number;
  pendingModCount: number;
  suggestionCount: number;
  participantCount: number;
  participantSample: WorkshopParticipantSample[];
  topMods: WorkshopTopMod[];
  packModSample: WorkshopPackSampleMod[];
}

export type WorkshopListItem = Workshop & { summary: WorkshopSummary | null };

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

export type WorkshopReviewAction = WorkshopModReviewAction;

const USER_VISIBLE_MOD_STATUSES: WorkshopModStatus[] = [
  "pending",
  "approved",
  "testing",
  "next_update",
  "in_pack",
];

interface PreparedEntry {
  projectId: number;
  note: string | null;
  fileId: number | null;
  fileName: string | null;
  fileReleaseType: number | null;
}

type TxQueries = Parameters<Parameters<typeof db.inTransaction>[0]>[0];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

/**
 * Community modpack workshop: user submissions, admin curation, and
 * per-workshop rejections. All CurseForge lookups go through the project
 * snapshot cache; validation guards run against the live API at submit time.
 */
export class WorkshopService {
  /** Workshops users may see (open and closed), with stats for open ones. */
  async listVisibleWorkshops(): Promise<WorkshopListItem[]> {
    const workshops = await Q.workshop.findAll(
      { status: { $in: ["open", "closed"] } },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return Promise.all(
      workshops.map(async (workshop) => ({
        ...workshop,
        summary:
          workshop.status === "open"
            ? await this.getWorkshopSummary(workshop)
            : null,
      })),
    );
  }

  /** All workshops regardless of status, for the admin panel. */
  async listAllWorkshops(): Promise<(Workshop & { modCount: number })[]> {
    return Q.workshop.listAllWithModCount();
  }

  /** A user-visible workshop by slug; drafts and archived workshops read as missing. */
  async getVisibleWorkshopBySlug(slug: string): Promise<Workshop> {
    const workshop = await Q.workshop.find({ slug });
    if (
      !workshop ||
      workshop.status === "draft" ||
      workshop.status === "archived"
    ) {
      throw new NotFoundError(`Workshop "${slug}" not found`);
    }
    return workshop;
  }

  /** A workshop by id regardless of status; throws when missing. */
  async getWorkshop(workshopId: number): Promise<Workshop> {
    const workshop = await Q.workshop.find({ id: workshopId });
    if (!workshop) throw new NotFoundError(`Workshop #${workshopId} not found`);
    return workshop;
  }

  /** Suggestions in a workshop with project summaries and upvote counts. */
  async getWorkshopMods(
    workshopId: number,
    options: { includeHidden?: boolean; statuses?: WorkshopModStatus[] } = {},
  ): Promise<WorkshopModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    const statuses =
      options.statuses ??
      (options.includeHidden ? null : USER_VISIBLE_MOD_STATUSES);
    const mods = await Q.workshop.mod.findAll(
      {
        workshopId,
        ...(statuses ? { status: { $in: statuses } } : {}),
      },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return this.decorateMods(workshop, mods);
  }

  /** One mod in the same shape as the workshop listing. */
  async getWorkshopModListItem(
    workshopModId: number,
  ): Promise<WorkshopModListItem> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod) {
      throw new NotFoundError(`Mod #${workshopModId} not found`);
    }
    const workshop = await this.getWorkshop(mod.workshopId);
    const [item] = await this.decorateMods(workshop, [mod]);
    if (!item) {
      throw new NotFoundError(
        `CurseForge project #${mod.curseforgeProjectId} is not cached`,
      );
    }
    return item;
  }

  /** Members of the workshop's modpack, for the admin members card. */
  async getPackMods(workshopId: number): Promise<ModpackModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    return modpackService.getPackMods(workshop.modpackId);
  }

  /** The workshop's modpack with its members, for the pack page. */
  async getPack(
    workshopId: number,
    options: { userVisible?: boolean } = {},
  ): Promise<WorkshopPackView> {
    const workshop = await this.getWorkshop(workshopId);
    if (options.userVisible) this.assertUserVisible(workshop);
    const modpack = await modpackService.getModpack(workshop.modpackId);
    const [mods, curseforgeUrl] = await Promise.all([
      modpackService.getPackMods(modpack.id),
      modpackService.getPackCurseforgeUrl(modpack),
    ]);
    return {
      modpack: {
        name: modpack.name,
        description: modpack.description,
        curseforgeUrl,
      },
      mods,
    };
  }

  /** A single mod with the full cached project detail (description included). */
  async getModDetail(
    workshopModId: number,
    options: { includeHidden?: boolean } = {},
  ): Promise<{
    mod: WorkshopMod & {
      submitterName: string | null;
      reviewerName: string | null;
      discordThreadUrl: string | null;
      dependencies: WorkshopModDependencyInfo[];
      liveInVersion: string | null;
    };
    project: CurseforgeProject;
    upvoteCount: number;
  }> {
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod) {
      throw new NotFoundError(`Mod #${workshopModId} not found`);
    }
    const workshop = await this.getWorkshop(mod.workshopId);
    if (!options.includeHidden) {
      this.assertUserVisible(workshop);
    }
    const [project, upvoteCount, submitter, reviewer, depRows, packRow] =
      await Promise.all([
        Q.curseforge.project.get({ id: mod.curseforgeProjectId }),
        Q.workshop.mod.upvote.count({ workshopModId }),
        Q.player.find({ discordId: mod.submittedBy }),
        mod.reviewedBy ? Q.player.find({ discordId: mod.reviewedBy }) : null,
        Q.workshop.project.dependency.findAll({
          workshopId: mod.workshopId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
        Q.modpack.mod.find({
          modpackId: workshop.modpackId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
      ]);
    const depsByProject = await this.buildDependencyInfo(workshop, depRows);
    return {
      mod: {
        ...mod,
        submitterName: submitter?.minecraftUsername ?? null,
        reviewerName: reviewer?.minecraftUsername ?? null,
        discordThreadUrl: mod.discordThreadId
          ? discordThreadUrl(mod.discordThreadId)
          : null,
        dependencies: depsByProject.get(mod.curseforgeProjectId) ?? [],
        liveInVersion: packRow?.liveInVersion ?? null,
      },
      project,
      upvoteCount,
    };
  }

  /**
   * CurseForge search scoped to the workshop's target, annotated with submit
   * guards. User-visible searches require an open workshop, since search
   * exists to feed suggestions and proxies the live API.
   */
  async searchProjects(
    workshopId: number,
    query: string,
    options: { userVisible?: boolean } = {},
  ): Promise<WorkshopProjectSearchResult[]> {
    const workshop = options.userVisible
      ? await this.getOpenWorkshop(workshopId)
      : await this.getWorkshop(workshopId);
    const results = await searchMods(query, 20, {
      gameVersion: workshop.gameVersion,
      modLoaderType: workshop.modLoaderType,
      classId: workshop.classId,
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

  /** The caller's own suggestions in a workshop, all statuses. */
  async getMySuggestions(
    workshopId: number,
    discordId: string,
  ): Promise<WorkshopModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    this.assertUserVisible(workshop);
    const mods = await Q.workshop.mod.findAll(
      { workshopId, submittedBy: discordId },
      { orderBy: "createdAt", orderDirection: "asc" },
    );
    return this.decorateMods(workshop, mods);
  }

  /** The caller's suggestions across all user-visible workshops, newest first. */
  async getMySuggestionHistory(
    discordId: string,
  ): Promise<WorkshopSuggestionHistoryItem[]> {
    const workshops = await Q.workshop.findAll({
      status: { $in: ["open", "closed"] },
    });
    if (workshops.length === 0) return [];
    const mods = await Q.workshop.mod.findAll({
      submittedBy: discordId,
      workshopId: { $in: workshops.map((w) => w.id) },
    });
    const byWorkshop = new Map<number, WorkshopMod[]>();
    for (const mod of mods) {
      const list = byWorkshop.get(mod.workshopId) ?? [];
      list.push(mod);
      byWorkshop.set(mod.workshopId, list);
    }
    const decorated = await Promise.all(
      workshops.flatMap((workshop) => {
        const own = byWorkshop.get(workshop.id);
        if (!own) return [];
        return [
          this.decorateMods(workshop, own).then((items) =>
            items.map((item) => ({
              ...item,
              workshopName: workshop.name,
              workshopSlug: workshop.slug,
            })),
          ),
        ];
      }),
    );
    return decorated
      .flat()
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
      );
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
    const workshop = await this.getOpenWorkshop(workshopId);
    await assertCanSuggest(discordId, workshop.id);
    await this.assertSuggestionSlot(Q, workshop, discordId);

    const [prepared] = await this.prepareEntries(workshop, [entry]);

    let created: WorkshopMod;
    try {
      created = await db.inTransaction(async (tx) => {
        await tx.workshop.lockUserBudget(workshop.id, discordId);
        await this.assertSuggestionSlot(tx, workshop, discordId);
        const mod = await this.createMod(tx, workshop, prepared, {
          submittedBy: discordId,
        });
        await tx.workshop.mod.upvote.create({
          workshopModId: mod.id,
          discordId,
        });
        return mod;
      });
    } catch (error) {
      this.mapConstraintError(error);
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
    const [item] = await this.decorateMods(workshop, [created]);
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
    await this.getOpenWorkshop(mod.workshopId);
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
    const workshop = await this.getOpenWorkshop(mod.workshopId);

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
          error instanceof ConstraintViolationError &&
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
    const workshop = await this.getWorkshop(workshopId);
    this.assertUserVisible(workshop);
    const mods = await Q.workshop.mod.findAll(
      { workshopId },
      { select: ["id"] },
    );
    const modIds = mods.map((m) => m.id);
    const [modUpvotes, used] = await Promise.all([
      modIds.length > 0
        ? Q.workshop.mod.upvote.findAll({
            discordId,
            workshopModId: { $in: modIds },
          })
        : Promise.resolve([]),
      Q.workshop.mod.upvote.countPendingByUser(workshopId, discordId),
    ]);

    return {
      modIds: modUpvotes.map((u) => u.workshopModId),
      maxUpvotes: workshop.maxUpvotesPerUser,
      votesRemaining: Math.max(0, workshop.maxUpvotesPerUser - used),
    };
  }

  /** Create a workshop campaign feeding an existing modpack. */
  async createWorkshop(
    input: {
      name: string;
      slug?: string;
      description?: string;
      gameVersion: string;
      modLoaderType: number;
      classId?: number;
      baseModpackProjectId?: number | null;
      modpackId?: number;
      newModpackName?: string;
      maxModsPerUser?: number;
      maxUpvotesPerUser?: number;
      discordForumChannelId?: string | null;
    },
    adminId: string,
  ): Promise<Workshop> {
    const { modpackId, newModpackName } = input;
    if (modpackId !== undefined && newModpackName !== undefined) {
      throw new BadRequestError(
        "Provide either an existing modpack or a new modpack name, not both",
      );
    }

    const slug = input.slug ?? slugify(input.name);
    if (!slug)
      throw new BadRequestError("Workshop name produces an empty slug");

    const existing = await Q.workshop.find({ slug });
    if (existing) {
      throw new ConflictError(`A workshop with slug "${slug}" already exists`);
    }

    if (modpackId !== undefined) {
      await modpackService.getModpack(modpackId);
    }
    if (input.baseModpackProjectId) {
      await this.assertBaseModpack(input.baseModpackProjectId);
    }
    if (input.discordForumChannelId) {
      await assertForumChannel(input.discordForumChannelId);
    }

    const row = (targetModpackId: number) => ({
      name: input.name,
      slug,
      description: input.description ?? null,
      gameVersion: input.gameVersion,
      modLoaderType: input.modLoaderType,
      classId: input.classId ?? CurseForgeClass.mods,
      baseModpackProjectId: input.baseModpackProjectId ?? null,
      modpackId: targetModpackId,
      maxModsPerUser: input.maxModsPerUser ?? 5,
      maxUpvotesPerUser: input.maxUpvotesPerUser ?? 5,
      discordForumChannelId: input.discordForumChannelId ?? null,
      createdBy: adminId,
    });

    try {
      if (newModpackName !== undefined) {
        return await db.inTransaction(async (tx) => {
          const modpack = await tx.modpack.createAndReturn({
            name: newModpackName,
            description: null,
            curseforgeProjectId: null,
            serverId: null,
            createdBy: adminId,
          });
          return tx.workshop.createAndReturn(row(modpack.id));
        });
      }
      if (modpackId !== undefined) {
        return await Q.workshop.createAndReturn(row(modpackId));
      }
      throw new BadRequestError(
        "Provide either an existing modpack or a name for a new one",
      );
    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        throw new ConflictError(
          `A workshop with slug "${slug}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Update workshop fields, including lifecycle status. Renaming the slug
   * throws ConflictError when another workshop already uses it.
   */
  async updateWorkshop(
    workshopId: number,
    patch: Partial<{
      name: string;
      slug: string;
      description: string | null;
      status: Workshop["status"];
      classId: number;
      baseModpackProjectId: number | null;
      modpackId: number;
      maxModsPerUser: number;
      maxUpvotesPerUser: number;
      discordForumChannelId: string | null;
    }>,
  ): Promise<Workshop> {
    const workshop = await this.getWorkshop(workshopId);

    if (
      patch.status &&
      patch.status !== workshop.status &&
      !WORKSHOP_STATUS_TRANSITIONS[workshop.status].includes(patch.status)
    ) {
      throw new BadRequestError(
        `A ${workshop.status} workshop cannot move to ${patch.status}`,
      );
    }

    const targetChanged =
      (patch.classId !== undefined && patch.classId !== workshop.classId) ||
      (patch.baseModpackProjectId !== undefined &&
        patch.baseModpackProjectId !== workshop.baseModpackProjectId) ||
      (patch.modpackId !== undefined && patch.modpackId !== workshop.modpackId);
    if (targetChanged && (await Q.workshop.mod.count({ workshopId })) > 0) {
      throw new BadRequestError(
        "Cannot change the project type, base modpack, or modpack of a workshop that already has mods",
      );
    }

    if (
      patch.modpackId !== undefined &&
      patch.modpackId !== workshop.modpackId
    ) {
      await modpackService.getModpack(patch.modpackId);
    }
    if (
      patch.baseModpackProjectId != null &&
      patch.baseModpackProjectId !== workshop.baseModpackProjectId
    ) {
      await this.assertBaseModpack(patch.baseModpackProjectId);
    }

    if (
      patch.discordForumChannelId &&
      patch.discordForumChannelId !== workshop.discordForumChannelId
    ) {
      await assertForumChannel(patch.discordForumChannelId);
    }

    if (patch.slug !== undefined && patch.slug !== workshop.slug) {
      const existing = await Q.workshop.find({ slug: patch.slug });
      if (existing) {
        throw new ConflictError(
          `A workshop with slug "${patch.slug}" already exists`,
        );
      }
    }

    try {
      return await Q.workshop.updateAndReturn({ id: workshopId }, patch);
    } catch (error) {
      if (
        error instanceof ConstraintViolationError &&
        patch.slug !== undefined
      ) {
        throw new ConflictError(
          `A workshop with slug "${patch.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Delete an archived workshop with its suggestions, votes, polls, and event
   * history. Modpack member rows survive with their suggestion link detached,
   * so per-mod credit in the pack is lost. Discord threads are left alone.
   */
  async deleteWorkshop(workshopId: number): Promise<Workshop> {
    const workshop = await this.getWorkshop(workshopId);
    if (workshop.status !== "archived") {
      throw new BadRequestError("Only archived workshops can be deleted");
    }
    await Q.workshop.delete({ id: workshop.id });
    return workshop;
  }

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

    const workshop = await this.getWorkshop(mod.workshopId);
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

    const changed = await Q.workshop.mod.updateAll(
      target === "rejected"
        ? {
            status: "rejected",
            rejectReason: options.reason,
            rejectNote: options.note?.trim() || null,
            reviewedBy: adminId,
            reviewedAt: new Date(),
          }
        : {
            status: target,
            rejectReason: null,
            rejectNote: null,
            reviewedBy: adminId,
            reviewedAt: new Date(),
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

    const { coverage } = await loadDependencyContext(workshop);
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
   * next_update before reaching the pack.
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
    const workshop = await this.getWorkshop(workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError("Cannot add mods to an archived workshop");
    }
    const prepared = await this.prepareEntries(
      workshop,
      projectIds.map((projectId) => ({ projectId, note })),
    );

    let created: WorkshopMod[];
    try {
      created = await db.inTransaction(async (tx) => {
        const mods: WorkshopMod[] = [];
        for (const entry of prepared) {
          const mod = await this.createMod(tx, workshop, entry, {
            submittedBy: adminId,
            status: "approved",
            reviewedBy: adminId,
          });
          await tx.workshop.mod.upvote.create({
            workshopModId: mod.id,
            discordId: adminId,
          });
          mods.push(mod);
        }
        return mods;
      });
    } catch (error) {
      this.mapConstraintError(error);
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
    const items = await this.decorateMods(workshop, created);
    void (async () => {
      for (const item of items) await announceSuggestion(workshop, item);
      await tryResolveProjectDependencies(workshop, created);
    })();
    return items;
  }

  /** Rejected mods in a user-visible workshop, for the public ruled-out list. */
  async getRejectedMods(workshopId: number): Promise<WorkshopModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    this.assertUserVisible(workshop);
    const mods = await Q.workshop.mod.findAll(
      { workshopId, status: "rejected" },
      { orderBy: "reviewedAt", orderDirection: "desc" },
    );
    return this.decorateMods(workshop, mods);
  }

  /** Workshop-wide dependency coverage, one row per depended-on project. */
  async getWorkshopDependencies(
    workshopId: number,
  ): Promise<WorkshopDependencyListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    const [edges, context] = await Promise.all([
      Q.workshop.project.dependency.findAll({ workshopId }),
      loadDependencyContext(workshop),
    ]);
    if (edges.length === 0) return [];

    const projectIds = [
      ...new Set(
        edges.flatMap((edge) => [
          edge.dependsOnProjectId,
          edge.curseforgeProjectId,
        ]),
      ),
    ];
    const projects = await Q.curseforge.project.findAll({
      id: { $in: projectIds },
    });
    const projectById = new Map(
      projects.map((project) => [project.id, project]),
    );

    const byDependency = new Map<number, typeof edges>();
    for (const edge of edges) {
      const group = byDependency.get(edge.dependsOnProjectId) ?? [];
      group.push(edge);
      byDependency.set(edge.dependsOnProjectId, group);
    }

    const rows = [...byDependency.entries()].map(([dependencyId, group]) => {
      const project = projectById.get(dependencyId);
      const requiredIds = [
        ...new Set(
          group
            .filter((edge) => edge.relationType === REQUIRED_DEPENDENCY)
            .map((edge) => edge.curseforgeProjectId),
        ),
      ];
      const optionalIds = new Set(
        group
          .filter((edge) => edge.relationType !== REQUIRED_DEPENDENCY)
          .map((edge) => edge.curseforgeProjectId),
      );
      return {
        curseforgeProjectId: dependencyId,
        name: project?.name ?? null,
        slug: project?.slug ?? null,
        thumbnailUrl: project?.thumbnailUrl ?? null,
        coverage: context.coverage.get(dependencyId) ?? ("missing" as const),
        requiredBy: requiredIds.map((id) => ({
          curseforgeProjectId: id,
          name: projectById.get(id)?.name ?? `#${id}`,
        })),
        optionalByCount: optionalIds.size,
        shippingDemand: context.demand.get(dependencyId) ?? 0,
      };
    });

    return rows;
  }

  private async getWorkshopSummary(
    workshop: Workshop,
  ): Promise<WorkshopSummary> {
    const workshopId = workshop.id;
    const [packModCount, pendingModCount, participantIds, mods, packSample] =
      await Promise.all([
        Q.modpack.mod.count({ modpackId: workshop.modpackId }),
        Q.workshop.mod.count({ workshopId, status: "pending" }),
        Q.workshop.participantDiscordIds(workshopId),
        Q.workshop.mod.findAll(
          { workshopId, status: { $in: USER_VISIBLE_MOD_STATUSES } },
          {
            orderBy: "createdAt",
            orderDirection: "desc",
            select: ["id", "curseforgeProjectId"],
          },
        ),
        Q.modpack.mod.findAll(
          { modpackId: workshop.modpackId },
          {
            orderBy: "createdAt",
            orderDirection: "desc",
            limit: PACK_SAMPLE_SIZE,
            select: ["id", "curseforgeProjectId"],
          },
        ),
      ]);

    const participants =
      participantIds.length > 0
        ? await Q.player.findAll({ discordId: { $in: participantIds } })
        : [];
    const participantSample = participants.slice(0, 5).map((player) => ({
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
    }));

    const upvoteCounts =
      mods.length > 0
        ? await Q.workshop.mod.upvote.countGroupedByMod(mods.map((m) => m.id))
        : {};
    const top = [...mods]
      .sort((a, b) => (upvoteCounts[b.id] ?? 0) - (upvoteCounts[a.id] ?? 0))
      .slice(0, 3);
    const projectIds = [
      ...new Set([...top, ...packSample].map((mod) => mod.curseforgeProjectId)),
    ];
    const projects =
      projectIds.length > 0
        ? await Q.curseforge.project.findAll({ id: { $in: projectIds } })
        : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const topMods = top.flatMap((mod) => {
      const project = projectById.get(mod.curseforgeProjectId);
      if (!project) return [];
      return [
        {
          workshopModId: mod.id,
          name: project.name,
          primaryAuthor: project.primaryAuthor,
          upvoteCount: upvoteCounts[mod.id] ?? 0,
          thumbnailUrl: project.thumbnailUrl,
        },
      ];
    });
    const packModSample = packSample.flatMap((row) => {
      const project = projectById.get(row.curseforgeProjectId);
      if (!project) return [];
      return [
        {
          id: row.id,
          name: project.name,
          thumbnailUrl: project.thumbnailUrl,
        },
      ];
    });

    return {
      packModCount,
      pendingModCount,
      suggestionCount: mods.length,
      participantCount: participantIds.length,
      participantSample,
      topMods,
      packModSample,
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

  private assertUserVisible(workshop: Workshop): void {
    if (workshop.status === "draft" || workshop.status === "archived") {
      throw new NotFoundError(`Workshop #${workshop.id} not found`);
    }
  }

  private async getOpenWorkshop(workshopId: number): Promise<Workshop> {
    const workshop = await this.getWorkshop(workshopId);
    this.assertUserVisible(workshop);
    if (workshop.status !== "open") {
      throw new BadRequestError("This workshop is not open for suggestions");
    }
    return workshop;
  }

  private async decorateMods(
    workshop: Workshop,
    mods: WorkshopMod[],
  ): Promise<WorkshopModListItem[]> {
    if (mods.length === 0) return [];

    const projectIds = [...new Set(mods.map((m) => m.curseforgeProjectId))];
    const submitterIds = [...new Set(mods.map((m) => m.submittedBy))];
    const [projects, upvoteCounts, submitters, depRows, packRows] =
      await Promise.all([
        Q.curseforge.project.findAll({ id: { $in: projectIds } }),
        Q.workshop.mod.upvote.countGroupedByMod(mods.map((m) => m.id)),
        Q.player.findAll({ discordId: { $in: submitterIds } }),
        Q.workshop.project.dependency.findAll({
          workshopId: workshop.id,
          curseforgeProjectId: { $in: projectIds },
        }),
        Q.modpack.mod.findAll({
          modpackId: workshop.modpackId,
          curseforgeProjectId: { $in: projectIds },
        }),
      ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const nameByDiscordId = new Map(
      submitters.map((p) => [p.discordId, p.minecraftUsername]),
    );
    const packByProjectId = new Map(
      packRows.map((row) => [row.curseforgeProjectId, row]),
    );
    const depsByProject = await this.buildDependencyInfo(workshop, depRows);

    return mods.flatMap((mod) => {
      const project = byId.get(mod.curseforgeProjectId);
      if (!project) return [];
      const packRow = packByProjectId.get(mod.curseforgeProjectId);
      return [
        {
          ...mod,
          project: this.toProjectSummary(project),
          upvoteCount: upvoteCounts[mod.id] ?? 0,
          submitterName: nameByDiscordId.get(mod.submittedBy) ?? null,
          discordThreadUrl: mod.discordThreadId
            ? discordThreadUrl(mod.discordThreadId)
            : null,
          dependencies: depsByProject.get(mod.curseforgeProjectId) ?? [],
          liveInVersion: packRow?.liveInVersion ?? null,
        },
      ];
    });
  }

  /**
   * Flag which side(s) a project runs on. Explicit sides become manual flags
   * that CurseForge hints never overwrite; unspecified clears the flag so the
   * next snapshot refresh may re-apply a CurseForge hint.
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

  private async buildDependencyInfo(
    workshop: Workshop,
    depRows: WorkshopProjectDependency[],
  ): Promise<Map<number, WorkshopModDependencyInfo[]>> {
    const byProject = new Map<number, WorkshopModDependencyInfo[]>();
    if (depRows.length === 0) return byProject;

    const depProjectIds = [
      ...new Set(depRows.map((d) => d.dependsOnProjectId)),
    ];
    const [depProjects, context] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: depProjectIds } }),
      loadDependencyContext(workshop),
    ]);
    const projectById = new Map(depProjects.map((p) => [p.id, p]));

    for (const dep of depRows) {
      const project = projectById.get(dep.dependsOnProjectId);
      const info: WorkshopModDependencyInfo = {
        curseforgeProjectId: dep.dependsOnProjectId,
        relationType: dep.relationType,
        name: project?.name ?? null,
        slug: project?.slug ?? null,
        thumbnailUrl: project?.thumbnailUrl ?? null,
        coverage: context.coverage.get(dep.dependsOnProjectId) ?? "missing",
        requiredByCount: context.demand.get(dep.dependsOnProjectId) ?? 0,
      };
      const list = byProject.get(dep.curseforgeProjectId) ?? [];
      list.push(info);
      byProject.set(dep.curseforgeProjectId, list);
    }
    return byProject;
  }

  private toProjectSummary(project: CurseforgeProject): WorkshopProjectSummary {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      summary: project.summary,
      thumbnailUrl: project.thumbnailUrl,
      websiteUrl: project.websiteUrl,
      primaryAuthor: project.primaryAuthor,
      categories: project.categories,
      downloadCount: project.downloadCount,
      dateReleased: project.dateReleased,
      allowModDistribution: project.allowModDistribution,
      environment: project.environment,
      environmentSource: project.environmentSource,
    };
  }

  /**
   * Run every submit-time guard over the requested projects and return
   * entries carrying the file snapshot for the workshop's target.
   */
  private async prepareEntries(
    workshop: Workshop,
    entries: WorkshopModEntry[],
  ): Promise<PreparedEntry[]> {
    if (entries.length === 0) return [];

    const projectIds = entries.map((e) => e.projectId);
    if (new Set(projectIds).size !== projectIds.length) {
      throw new BadRequestError("The request contains duplicate mods");
    }

    const [claims, packClaims] = await Promise.all([
      Q.workshop.mod.findAll({
        workshopId: workshop.id,
        curseforgeProjectId: { $in: projectIds },
      }),
      Q.modpack.mod.findAll({
        modpackId: workshop.modpackId,
        curseforgeProjectId: { $in: projectIds },
      }),
    ]);
    const rejectedClaims = claims.filter((c) => c.status === "rejected");
    if (rejectedClaims.length > 0) {
      const labels = await this.projectLabels(
        rejectedClaims.map((c) => c.curseforgeProjectId),
      );
      throw new BadRequestError(
        `Rejected in this workshop: ${labels.join(", ")}`,
      );
    }
    if (claims.length > 0) {
      const labels = await this.projectLabels(
        claims.map((c) => c.curseforgeProjectId),
      );
      throw new ConflictError(
        `Already suggested in this workshop: ${labels.join(", ")}`,
      );
    }
    if (packClaims.length > 0) {
      const labels = await this.projectLabels(
        packClaims.map((c) => c.curseforgeProjectId),
      );
      throw new ConflictError(`Already in the pack: ${labels.join(", ")}`);
    }

    if (workshop.baseModpackProjectId) {
      let basePackIds: Set<number>;
      try {
        basePackIds = await getModpackModIds(workshop.baseModpackProjectId);
      } catch (error) {
        logger.warn("Base modpack manifest fetch failed", error);
        throw new BadRequestError(
          "Could not check against the base modpack right now, please try again",
        );
      }
      const inPack = projectIds.filter((id) => basePackIds.has(id));
      if (inPack.length > 0) {
        const labels = await this.projectLabels(inPack);
        throw new BadRequestError(
          `Already part of the base modpack: ${labels.join(", ")}`,
        );
      }
    }

    let projectData: Map<number, CurseForgeProjectData>;
    try {
      projectData = await ingestProjects(projectIds);
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      logger.warn("CurseForge project ingest failed:", error);
      throw new BadRequestError(
        "Could not reach CurseForge right now, please try again",
      );
    }

    const prepared: PreparedEntry[] = [];
    for (const entry of entries) {
      const data = projectData.get(entry.projectId);
      if (!data) {
        throw new BadRequestError(
          `Could not resolve CurseForge project #${entry.projectId}`,
        );
      }
      if (data.classId !== workshop.classId) {
        throw new BadRequestError(
          `"${data.name}" is not the right kind of CurseForge project for this workshop`,
        );
      }
      prepared.push({
        projectId: entry.projectId,
        note: entry.note ?? null,
        ...this.snapshotFile(workshop, data),
      });
    }
    return prepared;
  }

  /** Pick the latest compatible file for the workshop's game version and loader. */
  private snapshotFile(
    workshop: Workshop,
    data: CurseForgeProjectData,
  ): Omit<PreparedEntry, "projectId" | "note"> {
    let index = data.latestFilesIndexes.find(
      (idx) =>
        idx.gameVersion === workshop.gameVersion &&
        idx.modLoader === workshop.modLoaderType,
    );
    if (!index && workshop.classId !== CurseForgeClass.mods) {
      index = data.latestFilesIndexes.find(
        (idx) => idx.gameVersion === workshop.gameVersion,
      );
    }
    if (!index) {
      throw new BadRequestError(
        `"${data.name}" has no file for ${workshop.gameVersion} with the workshop's mod loader`,
      );
    }

    return {
      fileId: index.fileId,
      fileName: index.filename,
      fileReleaseType: index.releaseType,
    };
  }

  private async createMod(
    tx: TxQueries,
    workshop: Workshop,
    entry: PreparedEntry,
    options: {
      submittedBy: string;
      status?: WorkshopModStatus;
      reviewedBy?: string;
    },
  ): Promise<WorkshopMod> {
    const reviewedBy = options.reviewedBy ?? null;
    return tx.workshop.mod.createAndReturn({
      workshopId: workshop.id,
      curseforgeProjectId: entry.projectId,
      submittedBy: options.submittedBy,
      status: options.status ?? "pending",
      note: entry.note,
      reviewedBy,
      reviewedAt: reviewedBy ? new Date() : null,
      fileId: entry.fileId,
      fileName: entry.fileName,
      fileReleaseType: entry.fileReleaseType,
    });
  }

  private async assertBaseModpack(projectId: number): Promise<void> {
    let data: CurseForgeProjectData;
    try {
      data = await getMod(projectId);
    } catch {
      throw new BadRequestError(
        `Could not resolve CurseForge project #${projectId}`,
      );
    }
    if (data.classId !== CurseForgeClass.modpacks) {
      throw new BadRequestError(
        `"${data.name}" is not a modpack on CurseForge`,
      );
    }
  }

  private async projectLabels(projectIds: number[]): Promise<string[]> {
    const unique = [...new Set(projectIds)];
    const projects = await Q.curseforge.project.findAll({
      id: { $in: unique },
    });
    const byId = new Map(projects.map((p) => [p.id, p.name]));
    return unique.map((id) => byId.get(id) ?? `#${id}`);
  }

  private mapConstraintError(error: unknown): never {
    if (error instanceof ConstraintViolationError) {
      throw new ConflictError(
        "Already suggested or ruled out in this workshop, refresh and try again",
      );
    }
    throw error;
  }
}

export const workshopService = new WorkshopService();
