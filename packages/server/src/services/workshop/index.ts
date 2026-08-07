import { db, Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { ConstraintViolationError } from "@/db/utils/errors";
import type {
  CurseforgeProject,
  ModpackMod,
  Workshop,
  WorkshopMod,
  WorkshopModRejectReason,
  WorkshopModStatus,
  WorkshopProjectDependency,
} from "@createrington/shared/db";
import { WORKSHOP_STATUS_TRANSITIONS } from "@createrington/shared/workshop";
import {
  CurseForgeClass,
  getMod,
  getModpackModIds,
  searchMods,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { ingestProject } from "@/services/curseforge/ingest";
import { modpackService } from "@/services/modpack";
import type { ModpackModListItem } from "@/services/modpack";
import {
  announceRemoval,
  announceReview,
  announceSuggestion,
  assertForumChannel,
  discordThreadUrl,
} from "./discord";
import {
  OPTIONAL_DEPENDENCY,
  promoteRequiredDependencies,
  pruneOrphanedDependencies,
  pruneStaleDependencyEdges,
  resolveProjectDependencies,
} from "./dependencies";

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
>;

export interface WorkshopModDependencyInfo {
  curseforgeProjectId: number;
  relationType: number;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  rejected: boolean;
}

export interface WorkshopModListItem extends WorkshopMod {
  project: WorkshopProjectSummary;
  upvoteCount: number;
  submitterName: string | null;
  discordThreadUrl: string | null;
  dependencies: WorkshopModDependencyInfo[];
  live: boolean;
  liveInVersion: string | null;
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

export interface WorkshopDependencyReport {
  pulled: ModpackModListItem[];
  optional: Array<{
    curseforgeProjectId: number;
    name: string | null;
    slug: string | null;
    thumbnailUrl: string | null;
    rejected: boolean;
    inWorkshop: boolean;
    wantedBy: Array<{ curseforgeProjectId: number; name: string }>;
  }>;
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

export interface WorkshopSummary {
  approvedModCount: number;
  pendingModCount: number;
  suggestionCount: number;
  participantCount: number;
  participantSample: WorkshopParticipantSample[];
  topMods: WorkshopTopMod[];
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

export type WorkshopReviewAction = "approve" | "reject";

const USER_VISIBLE_MOD_STATUSES: WorkshopModStatus[] = ["pending", "approved"];

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
  async listAllWorkshops(): Promise<Workshop[]> {
    return Q.workshop.findAll(
      {},
      { orderBy: "createdAt", orderDirection: "desc" },
    );
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
    options: { includeHidden?: boolean } = {},
  ): Promise<WorkshopModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    const mods = await Q.workshop.mod.findAll(
      {
        workshopId,
        ...(options.includeHidden
          ? {}
          : { status: { $in: USER_VISIBLE_MOD_STATUSES } }),
      },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return this.decorateMods(workshop, mods);
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
      discordThreadUrl: string | null;
      dependencies: WorkshopModDependencyInfo[];
      live: boolean;
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
    const [project, upvoteCount, submitter, depRows, packRow] =
      await Promise.all([
        Q.curseforge.project.get({ id: mod.curseforgeProjectId }),
        Q.workshop.mod.upvote.count({ workshopModId }),
        Q.player.find({ discordId: mod.submittedBy }),
        Q.workshop.project.dependency.findAll({
          workshopId: mod.workshopId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
        Q.modpack.mod.find({
          modpackId: workshop.modpackId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
      ]);
    const depsByProject = await this.buildDependencyInfo(
      mod.workshopId,
      depRows,
    );
    return {
      mod: {
        ...mod,
        submitterName: submitter?.minecraftUsername ?? null,
        discordThreadUrl: mod.discordThreadId
          ? discordThreadUrl(mod.discordThreadId)
          : null,
        dependencies: depsByProject.get(mod.curseforgeProjectId) ?? [],
        live: packRow?.liveAt != null,
        liveInVersion: packRow?.liveInVersion ?? null,
      },
      project,
      upvoteCount,
    };
  }

  /** CurseForge search scoped to the workshop's target, annotated with submit guards. */
  async searchProjects(
    workshopId: number,
    query: string,
    options: { userVisible?: boolean } = {},
  ): Promise<WorkshopProjectSearchResult[]> {
    const workshop = await this.getWorkshop(workshopId);
    if (options.userVisible) this.assertUserVisible(workshop);
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
   * Only pending suggestions count against the cap.
   */
  async suggestMod(
    workshopId: number,
    discordId: string,
    entry: WorkshopModEntry,
  ): Promise<WorkshopModListItem> {
    const workshop = await this.getOpenWorkshop(workshopId);
    await this.assertSuggestionSlot(Q, workshop, discordId);

    const [prepared] = await this.prepareEntries(workshop, [entry]);

    let created: WorkshopMod;
    try {
      created = await db.inTransaction(async (tx) => {
        await tx.workshop.lockUserBudget(workshop.id, discordId);
        await this.assertSuggestionSlot(tx, workshop, discordId);
        return this.createMod(tx, workshop, prepared, {
          submittedBy: discordId,
        });
      });
    } catch (error) {
      this.mapConstraintError(error);
    }

    const [item] = await this.decorateMods(workshop, [created]);
    if (!item) throw new NotFoundError(`Mod #${created.id} not found`);
    void announceSuggestion(workshop, item);
    void resolveProjectDependencies(workshop, [created]);
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
    void announceRemoval(mod);
  }

  /**
   * Toggle the caller's upvote on a visible mod in an open workshop. Upvotes on
   * pending mods draw from the per-workshop budget; a review refunds them. Upvotes
   * on approved mods are free likes.
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
    if (mod.submittedBy === discordId) {
      throw new BadRequestError("You cannot upvote your own suggestion");
    }

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
          if (mod.status === "pending") {
            await tx.workshop.lockUserBudget(workshop.id, discordId);
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
        if (!(error instanceof ConstraintViolationError)) throw error;
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
      modpackId: number;
      maxModsPerUser?: number;
      maxUpvotesPerUser?: number;
      discordForumChannelId?: string | null;
    },
    adminId: string,
  ): Promise<Workshop> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug)
      throw new BadRequestError("Workshop name produces an empty slug");

    const existing = await Q.workshop.find({ slug });
    if (existing) {
      throw new ConflictError(`A workshop with slug "${slug}" already exists`);
    }

    await modpackService.getModpack(input.modpackId);
    if (input.baseModpackProjectId) {
      await this.assertBaseModpack(input.baseModpackProjectId);
    }
    if (input.discordForumChannelId) {
      await assertForumChannel(input.discordForumChannelId);
    }

    try {
      return await Q.workshop.createAndReturn({
        name: input.name,
        slug,
        description: input.description ?? null,
        gameVersion: input.gameVersion,
        modLoaderType: input.modLoaderType,
        classId: input.classId ?? CurseForgeClass.mods,
        baseModpackProjectId: input.baseModpackProjectId ?? null,
        modpackId: input.modpackId,
        maxModsPerUser: input.maxModsPerUser ?? 5,
        maxUpvotesPerUser: input.maxUpvotesPerUser ?? 5,
        discordForumChannelId: input.discordForumChannelId ?? null,
        createdBy: adminId,
      });
    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        throw new ConflictError(
          `A workshop with slug "${slug}" already exists`,
        );
      }
      throw error;
    }
  }

  /** Update workshop fields, including lifecycle status. */
  async updateWorkshop(
    workshopId: number,
    patch: Partial<{
      name: string;
      description: string | null;
      status: Workshop["status"];
      gameVersion: string;
      modLoaderType: number;
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
      (patch.gameVersion !== undefined &&
        patch.gameVersion !== workshop.gameVersion) ||
      (patch.modLoaderType !== undefined &&
        patch.modLoaderType !== workshop.modLoaderType) ||
      (patch.classId !== undefined && patch.classId !== workshop.classId) ||
      (patch.baseModpackProjectId !== undefined &&
        patch.baseModpackProjectId !== workshop.baseModpackProjectId) ||
      (patch.modpackId !== undefined && patch.modpackId !== workshop.modpackId);
    if (targetChanged && (await Q.workshop.mod.count({ workshopId })) > 0) {
      throw new BadRequestError(
        "Cannot change the game version, mod loader, project type, base modpack, or modpack of a workshop that already has mods",
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

    return Q.workshop.updateAndReturn({ id: workshopId }, patch);
  }

  /**
   * Review a mod: approve it into the pack, or reject it for this workshop
   * with a reason. Rejected rows persist and can be re-reviewed.
   */
  async reviewMod(
    workshopModId: number,
    action: WorkshopReviewAction,
    adminId: string,
    options: { reason?: WorkshopModRejectReason; note?: string } = {},
  ): Promise<WorkshopMod> {
    if (action === "reject" && !options.reason) {
      throw new BadRequestError("A reason is required to reject a mod");
    }
    const mod = await Q.workshop.mod.find({ id: workshopModId });
    if (!mod) throw new NotFoundError(`Mod #${workshopModId} not found`);
    if (action === "approve" && mod.status === "approved") return mod;

    const workshop = await this.getWorkshop(mod.workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError("Cannot review mods in an archived workshop");
    }

    const changed = await Q.workshop.mod.updateAll(
      action === "approve"
        ? {
            status: "approved",
            rejectReason: null,
            rejectNote: null,
            reviewedBy: adminId,
            reviewedAt: new Date(),
          }
        : {
            status: "rejected",
            rejectReason: options.reason,
            rejectNote: options.note?.trim() || null,
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

    void announceReview(
      updated,
      action === "approve" ? "approved" : "rejected",
    );
    if (action === "approve") {
      const packRow = await this.ensurePackRow(workshop, updated);
      if (packRow) {
        await promoteRequiredDependencies(workshop, packRow, adminId);
      }
    } else if (mod.status === "approved") {
      await Q.modpack.mod.deleteAll({
        modpackId: workshop.modpackId,
        workshopModId: updated.id,
      });
      await pruneOrphanedDependencies(workshop.modpackId);
      await pruneStaleDependencyEdges(workshop);
    }
    return updated;
  }

  /**
   * Create the approved suggestion's modpack row, or claim an existing row
   * for the same project (a manifest import that arrived first).
   */
  private async ensurePackRow(
    workshop: Workshop,
    mod: WorkshopMod,
  ): Promise<ModpackMod | null> {
    try {
      return await Q.modpack.mod.createAndReturn({
        modpackId: workshop.modpackId,
        curseforgeProjectId: mod.curseforgeProjectId,
        origin: "suggestion",
        workshopModId: mod.id,
        addedBy: null,
        fileId: mod.fileId,
        fileName: mod.fileName,
        fileReleaseType: mod.fileReleaseType,
      });
    } catch (error) {
      if (!(error instanceof ConstraintViolationError)) throw error;
      await Q.modpack.mod.updateAll(
        { origin: "suggestion", workshopModId: mod.id, addedBy: null },
        {
          modpackId: workshop.modpackId,
          curseforgeProjectId: mod.curseforgeProjectId,
        },
      );
      return Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: mod.curseforgeProjectId,
      });
    }
  }

  /** Add mods directly to the workshop's modpack, bypassing the suggestion funnel. */
  async addModsAsAdmin(
    workshopId: number,
    projectIds: number[],
    adminId: string,
  ): Promise<ModpackModListItem[]> {
    const workshop = await this.getWorkshop(workshopId);
    if (workshop.status === "archived") {
      throw new BadRequestError("Cannot add mods to an archived workshop");
    }
    const prepared = await this.prepareEntries(
      workshop,
      projectIds.map((projectId) => ({ projectId })),
    );

    try {
      await db.inTransaction(async (tx) => {
        for (const entry of prepared) {
          await tx.modpack.mod.create({
            modpackId: workshop.modpackId,
            curseforgeProjectId: entry.projectId,
            origin: "admin",
            workshopModId: null,
            addedBy: adminId,
            fileId: entry.fileId,
            fileName: entry.fileName,
            fileReleaseType: entry.fileReleaseType,
          });
        }
      });
    } catch (error) {
      this.mapConstraintError(error);
    }

    const rows = await Q.modpack.mod.findAll({
      modpackId: workshop.modpackId,
      curseforgeProjectId: { $in: projectIds },
    });
    void (async () => {
      await resolveProjectDependencies(workshop, rows);
      for (const row of rows) {
        await promoteRequiredDependencies(workshop, row, adminId);
      }
    })();
    return modpackService.decoratePackMods(workshop.modpackId, rows);
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

  /** Dependency-pulled pack mods and aggregated optional deps, for the admin report. */
  async getDependencyReport(
    workshopId: number,
  ): Promise<WorkshopDependencyReport> {
    const workshop = await this.getWorkshop(workshopId);
    const [packRows, suggestions, edges] = await Promise.all([
      Q.modpack.mod.findAll({ modpackId: workshop.modpackId }),
      Q.workshop.mod.findAll({ workshopId }),
      Q.workshop.project.dependency.findAll({ workshopId }),
    ]);

    const pulled = await modpackService.decoratePackMods(
      workshop.modpackId,
      packRows.filter((row) => row.origin === "dependency"),
    );

    const subjectProjectIds = new Set([
      ...packRows.map((row) => row.curseforgeProjectId),
      ...suggestions
        .filter((m) => USER_VISIBLE_MOD_STATUSES.includes(m.status))
        .map((m) => m.curseforgeProjectId),
    ]);
    const optionalRows = edges.filter(
      (edge) =>
        edge.relationType === OPTIONAL_DEPENDENCY &&
        subjectProjectIds.has(edge.curseforgeProjectId),
    );

    const optionalIds = [
      ...new Set(optionalRows.map((edge) => edge.dependsOnProjectId)),
    ];
    const namedIds = [
      ...new Set([
        ...optionalIds,
        ...optionalRows.map((edge) => edge.curseforgeProjectId),
      ]),
    ];
    const projects =
      namedIds.length > 0
        ? await Q.curseforge.project.findAll({ id: { $in: namedIds } })
        : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const rejectedProjectIds = new Set(
      suggestions
        .filter((m) => m.status === "rejected")
        .map((m) => m.curseforgeProjectId),
    );

    const optional = optionalIds
      .map((id) => {
        const project = projectById.get(id);
        return {
          curseforgeProjectId: id,
          name: project?.name ?? null,
          slug: project?.slug ?? null,
          thumbnailUrl: project?.thumbnailUrl ?? null,
          rejected: rejectedProjectIds.has(id),
          inWorkshop: subjectProjectIds.has(id),
          wantedBy: optionalRows
            .filter((edge) => edge.dependsOnProjectId === id)
            .map((edge) => ({
              curseforgeProjectId: edge.curseforgeProjectId,
              name:
                projectById.get(edge.curseforgeProjectId)?.name ??
                `#${edge.curseforgeProjectId}`,
            })),
        };
      })
      .sort((a, b) => b.wantedBy.length - a.wantedBy.length);

    return { pulled, optional };
  }

  private async getWorkshopSummary(
    workshop: Workshop,
  ): Promise<WorkshopSummary> {
    const workshopId = workshop.id;
    const [approvedModCount, pendingModCount, participantIds, mods] =
      await Promise.all([
        Q.modpack.mod.count({ modpackId: workshop.modpackId }),
        Q.workshop.mod.count({ workshopId, status: "pending" }),
        Q.workshop.participantDiscordIds(workshopId),
        this.getWorkshopMods(workshopId),
      ]);

    const participants =
      participantIds.length > 0
        ? await Q.player.findAll({ discordId: { $in: participantIds } })
        : [];
    const participantSample = participants.slice(0, 5).map((player) => ({
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
    }));

    const topMods = [...mods]
      .sort((a, b) => b.upvoteCount - a.upvoteCount)
      .slice(0, 3)
      .map((mod) => ({
        workshopModId: mod.id,
        name: mod.project.name,
        primaryAuthor: mod.project.primaryAuthor,
        upvoteCount: mod.upvoteCount,
        thumbnailUrl: mod.project.thumbnailUrl,
      }));

    return {
      approvedModCount,
      pendingModCount,
      suggestionCount: mods.length,
      participantCount: participantIds.length,
      participantSample,
      topMods,
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
    const depsByProject = await this.buildDependencyInfo(workshop.id, depRows);

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
          live: packRow?.liveAt != null,
          liveInVersion: packRow?.liveInVersion ?? null,
        },
      ];
    });
  }

  private async buildDependencyInfo(
    workshopId: number,
    depRows: WorkshopProjectDependency[],
  ): Promise<Map<number, WorkshopModDependencyInfo[]>> {
    const byProject = new Map<number, WorkshopModDependencyInfo[]>();
    if (depRows.length === 0) return byProject;

    const depProjectIds = [
      ...new Set(depRows.map((d) => d.dependsOnProjectId)),
    ];
    const [depProjects, rejectedRows] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: depProjectIds } }),
      Q.workshop.mod.findAll({
        workshopId,
        status: "rejected",
        curseforgeProjectId: { $in: depProjectIds },
      }),
    ]);
    const projectById = new Map(depProjects.map((p) => [p.id, p]));
    const rejectedIds = new Set(rejectedRows.map((r) => r.curseforgeProjectId));

    for (const dep of depRows) {
      const project = projectById.get(dep.dependsOnProjectId);
      const info: WorkshopModDependencyInfo = {
        curseforgeProjectId: dep.dependsOnProjectId,
        relationType: dep.relationType,
        name: project?.name ?? null,
        slug: project?.slug ?? null,
        thumbnailUrl: project?.thumbnailUrl ?? null,
        rejected: rejectedIds.has(dep.dependsOnProjectId),
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

    const prepared: PreparedEntry[] = [];
    for (const entry of entries) {
      const { data } = await ingestProject(entry.projectId);
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
    options: { submittedBy: string },
  ): Promise<WorkshopMod> {
    return tx.workshop.mod.createAndReturn({
      workshopId: workshop.id,
      curseforgeProjectId: entry.projectId,
      submittedBy: options.submittedBy,
      status: "pending",
      note: entry.note,
      reviewedBy: null,
      reviewedAt: null,
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
