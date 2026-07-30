import { db, Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { ConstraintViolationError } from "@/db/utils/errors";
import type {
  CurseforgeProject,
  Vote,
  VoteMod,
  VoteModStatus,
} from "@createrington/shared/db";
import {
  CurseForgeClass,
  getMod,
  getModpackModIds,
  searchMods,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { ingestProject } from "@/services/curseforge/ingest";
import {
  announceReview,
  announceSuggestion,
  announceUnban,
  announceWithdrawal,
  assertForumChannel,
  discordThreadUrl,
} from "./discord";
import {
  OPTIONAL_DEPENDENCY,
  promoteRequiredDependencies,
  resolveModDependencies,
} from "./dependencies";

export type VoteProjectSummary = Pick<
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

export interface VoteModDependencyInfo {
  curseforgeProjectId: number;
  relationType: number;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  banned: boolean;
}

export interface VoteModListItem extends VoteMod {
  project: VoteProjectSummary;
  upvoteCount: number;
  submitterName: string | null;
  discordThreadUrl: string | null;
  dependencies: VoteModDependencyInfo[];
}

export interface VoteDependencyReport {
  pulled: Array<
    VoteModListItem & {
      pulledBy: { voteModId: number; name: string } | null;
    }
  >;
  optional: Array<{
    curseforgeProjectId: number;
    name: string | null;
    slug: string | null;
    thumbnailUrl: string | null;
    banned: boolean;
    inVote: boolean;
    wantedBy: Array<{ voteModId: number; name: string }>;
  }>;
}

export interface VoteModEntry {
  projectId: number;
  note?: string;
}

export interface VoteParticipantSample {
  minecraftUuid: string;
  minecraftUsername: string;
}

export interface VoteTopMod {
  voteModId: number;
  name: string;
  primaryAuthor: string | null;
  upvoteCount: number;
  thumbnailUrl: string | null;
}

export interface VoteSummary {
  approvedModCount: number;
  pendingModCount: number;
  participantCount: number;
  participantSample: VoteParticipantSample[];
  topMods: VoteTopMod[];
}

export type VoteListItem = Vote & { summary: VoteSummary | null };

export interface VoteProjectSearchResult {
  id: number;
  name: string;
  slug: string;
  url: string;
  thumbnailUrl?: string;
  inModpack: boolean;
  banned: boolean;
  claimed: boolean;
}

export type VoteReviewAction = "approve" | "decline" | "reject";

const USER_VISIBLE_MOD_STATUSES: VoteModStatus[] = ["pending", "approved"];

const VOTE_STATUS_TRANSITIONS: Record<Vote["status"], Vote["status"][]> = {
  draft: ["open"],
  open: ["closed"],
  closed: ["open", "archived"],
  archived: ["closed"],
};

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
 * Community modpack voting: user submissions, admin curation, and the global
 * rejection list. All CurseForge lookups go through the project snapshot
 * cache; validation guards run against the live API at submit time.
 */
export class VoteService {
  /** Votes users may see (open and closed), with stats for open ones. */
  async listVisibleVotes(): Promise<VoteListItem[]> {
    const votes = await Q.vote.findAll(
      { status: { $in: ["open", "closed"] } },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return Promise.all(
      votes.map(async (vote) => ({
        ...vote,
        summary:
          vote.status === "open" ? await this.getVoteSummary(vote.id) : null,
      })),
    );
  }

  /** All votes regardless of status, for the admin panel. */
  async listAllVotes(): Promise<Vote[]> {
    return Q.vote.findAll({}, { orderBy: "createdAt", orderDirection: "desc" });
  }

  /** A user-visible vote by slug; drafts and archived votes read as missing. */
  async getVisibleVoteBySlug(slug: string): Promise<Vote> {
    const vote = await Q.vote.find({ slug });
    if (!vote || vote.status === "draft" || vote.status === "archived") {
      throw new NotFoundError(`Workshop "${slug}" not found`);
    }
    return vote;
  }

  /** A vote by id regardless of status; throws when missing. */
  async getVote(voteId: number): Promise<Vote> {
    const vote = await Q.vote.find({ id: voteId });
    if (!vote) throw new NotFoundError(`Vote #${voteId} not found`);
    return vote;
  }

  /** Mods in a vote with project summaries and upvote counts. */
  async getVoteMods(
    voteId: number,
    options: { includeHidden?: boolean } = {},
  ): Promise<VoteModListItem[]> {
    const mods = await Q.vote.mod.findAll(
      {
        voteId,
        ...(options.includeHidden
          ? {}
          : { status: { $in: USER_VISIBLE_MOD_STATUSES } }),
      },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    return this.decorateMods(mods);
  }

  /** A single mod with the full cached project detail (description included). */
  async getModDetail(
    voteModId: number,
    options: { includeHidden?: boolean } = {},
  ): Promise<{
    mod: VoteMod & {
      submitterName: string | null;
      discordThreadUrl: string | null;
      dependencies: VoteModDependencyInfo[];
    };
    project: CurseforgeProject;
    upvoteCount: number;
  }> {
    const mod = await Q.vote.mod.find({ id: voteModId });
    if (
      !mod ||
      (!options.includeHidden &&
        !USER_VISIBLE_MOD_STATUSES.includes(mod.status))
    ) {
      throw new NotFoundError(`Mod #${voteModId} not found`);
    }
    if (!options.includeHidden) {
      this.assertUserVisible(await this.getVote(mod.voteId));
    }
    const [project, upvoteCount, submitter, depRows] = await Promise.all([
      Q.curseforge.project.get({ id: mod.curseforgeProjectId }),
      Q.vote.mod.upvote.count({ voteModId }),
      Q.player.find({ discordId: mod.submittedBy }),
      Q.vote.mod.dependency.findAll({ voteModId }),
    ]);
    const depsByMod = await this.buildDependencyInfo(depRows);
    return {
      mod: {
        ...mod,
        submitterName: submitter?.minecraftUsername ?? null,
        discordThreadUrl: mod.discordThreadId
          ? discordThreadUrl(mod.discordThreadId)
          : null,
        dependencies: depsByMod.get(mod.id) ?? [],
      },
      project,
      upvoteCount,
    };
  }

  /** CurseForge search scoped to the vote's target, annotated with submit guards. */
  async searchProjects(
    voteId: number,
    query: string,
    options: { userVisible?: boolean } = {},
  ): Promise<VoteProjectSearchResult[]> {
    const vote = await this.getVote(voteId);
    if (options.userVisible) this.assertUserVisible(vote);
    const results = await searchMods(query, 20, {
      gameVersion: vote.gameVersion,
      modLoaderType: vote.modLoaderType,
      classId: vote.classId,
      packProjectId: vote.baseModpackProjectId ?? null,
    });
    if (results.length === 0) return [];

    const ids = results.map((r) => r.id);
    const [bans, claims] = await Promise.all([
      Q.vote.mod.ban.findAll({ curseforgeProjectId: { $in: ids } }),
      Q.vote.mod.findAll({
        voteId: vote.id,
        curseforgeProjectId: { $in: ids },
        status: { $in: USER_VISIBLE_MOD_STATUSES },
      }),
    ]);
    const bannedIds = new Set(bans.map((b) => b.curseforgeProjectId));
    const claimedIds = new Set(claims.map((c) => c.curseforgeProjectId));

    return results.map((r) => ({
      ...r,
      banned: bannedIds.has(r.id),
      claimed: claimedIds.has(r.id),
    }));
  }

  /** The caller's own suggestions in a vote, all statuses. */
  async getMySuggestions(
    voteId: number,
    discordId: string,
  ): Promise<VoteModListItem[]> {
    const mods = await Q.vote.mod.findAll(
      { voteId, submittedBy: discordId, source: "user" },
      { orderBy: "createdAt", orderDirection: "asc" },
    );
    return this.decorateMods(mods);
  }

  /**
   * Suggest a single mod, consuming one of the caller's per-vote slots.
   * Declined and rejected suggestions do not count against the cap.
   */
  async suggestMod(
    voteId: number,
    discordId: string,
    entry: VoteModEntry,
  ): Promise<VoteModListItem> {
    const vote = await this.getOpenVote(voteId);

    const used = await Q.vote.mod.count({
      voteId,
      submittedBy: discordId,
      source: "user",
      status: { $in: USER_VISIBLE_MOD_STATUSES },
    });
    if (used >= vote.maxModsPerUser) {
      throw new BadRequestError(
        `You already have ${vote.maxModsPerUser} suggestions in this workshop, remove one first`,
      );
    }

    const [prepared] = await this.prepareEntries(vote, [entry]);

    let created: VoteMod;
    try {
      created = await db.inTransaction((tx) =>
        this.createMod(tx, vote, prepared, { submittedBy: discordId }),
      );
    } catch (error) {
      this.mapConstraintError(error);
    }

    const [item] = await this.decorateMods([created]);
    if (item) void announceSuggestion(vote, item);
    void resolveModDependencies(vote, [created]);
    return item;
  }

  /** Remove the caller's own pending suggestion, freeing a slot. */
  async removeSuggestion(voteModId: number, discordId: string): Promise<void> {
    const mod = await Q.vote.mod.find({ id: voteModId });
    if (!mod || mod.submittedBy !== discordId || mod.source !== "user") {
      throw new NotFoundError(`Suggestion #${voteModId} not found`);
    }
    await this.getOpenVote(mod.voteId);
    if (mod.status !== "pending") {
      throw new BadRequestError("Only pending suggestions can be removed");
    }
    await Q.vote.mod.delete({ id: voteModId });
    void announceWithdrawal(mod);
  }

  /**
   * Toggle the caller's upvote on a visible mod in an open vote. Upvotes on
   * pending mods draw from the per-vote budget; a review refunds them. Upvotes
   * on approved mods are free likes.
   */
  async toggleModUpvote(
    voteModId: number,
    discordId: string,
  ): Promise<{
    upvoted: boolean;
    upvoteCount: number;
    votesRemaining: number;
  }> {
    const mod = await Q.vote.mod.find({ id: voteModId });
    if (!mod || !USER_VISIBLE_MOD_STATUSES.includes(mod.status)) {
      throw new NotFoundError(`Mod #${voteModId} not found`);
    }
    const vote = await this.getOpenVote(mod.voteId);
    if (mod.submittedBy === discordId) {
      throw new BadRequestError("You cannot upvote your own suggestion");
    }

    const existing = await Q.vote.mod.upvote.find({ voteModId, discordId });
    let upvoted: boolean;
    if (existing) {
      await Q.vote.mod.upvote.deleteAll({ id: existing.id });
      upvoted = false;
    } else {
      if (mod.status === "pending") {
        const used = await Q.vote.mod.upvote.countPendingByUser(
          vote.id,
          discordId,
        );
        if (used >= vote.maxUpvotesPerUser) {
          throw new BadRequestError(
            `You have used all ${vote.maxUpvotesPerUser} of your votes, remove one or wait for a review`,
          );
        }
      }
      try {
        await Q.vote.mod.upvote.create({ voteModId, discordId });
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
      upvoted = true;
    }

    const [upvoteCount, used] = await Promise.all([
      Q.vote.mod.upvote.count({ voteModId }),
      Q.vote.mod.upvote.countPendingByUser(vote.id, discordId),
    ]);
    return {
      upvoted,
      upvoteCount,
      votesRemaining: Math.max(0, vote.maxUpvotesPerUser - used),
    };
  }

  /** IDs of the mods in a vote the caller has upvoted, plus their vote budget. */
  async getMyUpvotes(
    voteId: number,
    discordId: string,
  ): Promise<{ modIds: number[]; maxUpvotes: number; votesRemaining: number }> {
    const vote = await this.getVote(voteId);
    const mods = await Q.vote.mod.findAll({ voteId }, { select: ["id"] });
    const modIds = mods.map((m) => m.id);
    const [modUpvotes, used] = await Promise.all([
      modIds.length > 0
        ? Q.vote.mod.upvote.findAll({
            discordId,
            voteModId: { $in: modIds },
          })
        : Promise.resolve([]),
      Q.vote.mod.upvote.countPendingByUser(voteId, discordId),
    ]);

    return {
      modIds: modUpvotes.map((u) => u.voteModId),
      maxUpvotes: vote.maxUpvotesPerUser,
      votesRemaining: Math.max(0, vote.maxUpvotesPerUser - used),
    };
  }

  /** Create a vote campaign. */
  async createVote(
    input: {
      name: string;
      slug?: string;
      description?: string;
      gameVersion: string;
      modLoaderType: number;
      classId?: number;
      baseModpackProjectId?: number | null;
      maxModsPerUser?: number;
      maxUpvotesPerUser?: number;
      closesAt?: Date | null;
      discordForumChannelId?: string | null;
    },
    adminId: string,
  ): Promise<Vote> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw new BadRequestError("Vote name produces an empty slug");

    const existing = await Q.vote.find({ slug });
    if (existing) {
      throw new ConflictError(`A vote with slug "${slug}" already exists`);
    }

    if (input.baseModpackProjectId) {
      await this.assertBaseModpack(input.baseModpackProjectId);
    }
    if (input.discordForumChannelId) {
      await assertForumChannel(input.discordForumChannelId);
    }

    try {
      return await Q.vote.createAndReturn({
        name: input.name,
        slug,
        description: input.description ?? null,
        gameVersion: input.gameVersion,
        modLoaderType: input.modLoaderType,
        classId: input.classId ?? CurseForgeClass.mods,
        baseModpackProjectId: input.baseModpackProjectId ?? null,
        maxModsPerUser: input.maxModsPerUser ?? 5,
        maxUpvotesPerUser: input.maxUpvotesPerUser ?? 5,
        closesAt: input.closesAt ?? null,
        discordForumChannelId: input.discordForumChannelId ?? null,
        createdBy: adminId,
      });
    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        throw new ConflictError(`A vote with slug "${slug}" already exists`);
      }
      throw error;
    }
  }

  /** Update vote fields, including lifecycle status. */
  async updateVote(
    voteId: number,
    patch: Partial<{
      name: string;
      description: string | null;
      status: Vote["status"];
      gameVersion: string;
      modLoaderType: number;
      classId: number;
      baseModpackProjectId: number | null;
      maxModsPerUser: number;
      maxUpvotesPerUser: number;
      closesAt: Date | null;
      discordForumChannelId: string | null;
    }>,
  ): Promise<Vote> {
    const vote = await this.getVote(voteId);

    if (
      patch.status &&
      patch.status !== vote.status &&
      !VOTE_STATUS_TRANSITIONS[vote.status].includes(patch.status)
    ) {
      throw new BadRequestError(
        `A ${vote.status} vote cannot move to ${patch.status}`,
      );
    }

    const targetChanged =
      (patch.gameVersion !== undefined &&
        patch.gameVersion !== vote.gameVersion) ||
      (patch.modLoaderType !== undefined &&
        patch.modLoaderType !== vote.modLoaderType) ||
      (patch.classId !== undefined && patch.classId !== vote.classId);
    if (targetChanged && (await Q.vote.mod.count({ voteId })) > 0) {
      throw new BadRequestError(
        "Cannot change the game version, mod loader, or project type of a vote that already has mods",
      );
    }

    if (
      patch.baseModpackProjectId != null &&
      patch.baseModpackProjectId !== vote.baseModpackProjectId
    ) {
      await this.assertBaseModpack(patch.baseModpackProjectId);
    }

    if (
      patch.discordForumChannelId &&
      patch.discordForumChannelId !== vote.discordForumChannelId
    ) {
      await assertForumChannel(patch.discordForumChannelId);
    }

    return Q.vote.updateAndReturn({ id: voteId }, patch);
  }

  /** Review a pending or previously reviewed mod: approve, decline, or reject (global ban). */
  async reviewMod(
    voteModId: number,
    action: VoteReviewAction,
    adminId: string,
    reason?: string,
  ): Promise<VoteMod> {
    if (action === "reject" && !reason?.trim()) {
      throw new BadRequestError("A reason is required to reject a mod");
    }
    const mod = await Q.vote.mod.find({ id: voteModId });
    if (!mod) throw new NotFoundError(`Mod #${voteModId} not found`);

    const ban = await Q.vote.mod.ban.find({
      curseforgeProjectId: mod.curseforgeProjectId,
    });
    if (ban && action !== "reject") {
      throw new BadRequestError("This project is banned, remove the ban first");
    }

    try {
      const { updated, banned } = await db.inTransaction(async (tx) => {
        if (action === "reject") {
          const affected = await this.applyBan(
            tx,
            mod.curseforgeProjectId,
            adminId,
            reason,
          );
          if (mod.status === "declined") {
            await tx.vote.mod.update(
              { id: voteModId },
              {
                status: "rejected",
                reviewedBy: adminId,
                reviewedAt: new Date(),
              },
            );
            affected.push(mod);
          }
          return {
            updated: await tx.vote.mod.get({ id: voteModId }),
            banned: affected,
          };
        }

        const result = await tx.vote.mod.updateAndReturn(
          { id: voteModId },
          {
            status: action === "approve" ? "approved" : "declined",
            reviewedBy: adminId,
            reviewedAt: new Date(),
          },
        );
        return { updated: result, banned: [] as VoteMod[] };
      });

      if (action === "reject") {
        for (const affected of banned) {
          void announceReview(affected, "rejected", reason);
        }
      } else {
        void announceReview(
          updated,
          action === "approve" ? "approved" : "declined",
          reason,
        );
        if (action === "approve") {
          const vote = await this.getVote(updated.voteId);
          await promoteRequiredDependencies(vote, updated, adminId);
        }
      }
      return updated;
    } catch (error) {
      this.mapConstraintError(error);
    }
  }

  /** Add mods directly to a vote as approved, bypassing user review. */
  async addModsAsAdmin(
    voteId: number,
    projectIds: number[],
    adminId: string,
  ): Promise<VoteModListItem[]> {
    const vote = await this.getVote(voteId);
    if (vote.status === "archived") {
      throw new BadRequestError("Cannot add mods to an archived vote");
    }
    const prepared = await this.prepareEntries(
      vote,
      projectIds.map((projectId) => ({ projectId })),
    );

    try {
      await db.inTransaction(async (tx) => {
        for (const entry of prepared) {
          await this.createMod(tx, vote, entry, {
            submittedBy: adminId,
            source: "admin",
            status: "approved",
            reviewedBy: adminId,
          });
        }
      });
    } catch (error) {
      this.mapConstraintError(error);
    }

    const mods = await Q.vote.mod.findAll({
      voteId,
      curseforgeProjectId: { $in: projectIds },
      status: "approved",
    });
    const items = await this.decorateMods(mods);
    for (const item of items) {
      void announceSuggestion(vote, item);
    }
    void resolveModDependencies(vote, mods).then(async () => {
      for (const mod of mods) {
        await promoteRequiredDependencies(vote, mod, adminId);
      }
    });
    return items;
  }

  /** Globally ban a project and reject every live instance of it. */
  async banProject(
    projectId: number,
    adminId: string,
    reason: string,
  ): Promise<void> {
    if (!reason.trim()) {
      throw new BadRequestError("A reason is required to ban a project");
    }
    const cached = await Q.curseforge.project.find({ id: projectId });
    if (!cached) {
      try {
        await ingestProject(projectId);
      } catch {
        throw new BadRequestError(
          `Could not resolve CurseForge project #${projectId}`,
        );
      }
    }

    const affected = await db.inTransaction((tx) =>
      this.applyBan(tx, projectId, adminId, reason),
    );
    for (const mod of affected) {
      void announceReview(mod, "rejected", reason);
    }
  }

  /**
   * Lift a global ban. Rejected mod rows stay but become reviewable again;
   * their ban record threads are removed.
   */
  async unbanProject(projectId: number): Promise<void> {
    const ban = await Q.vote.mod.ban.find({ curseforgeProjectId: projectId });
    if (!ban) {
      throw new NotFoundError(`Project #${projectId} is not banned`);
    }
    await Q.vote.mod.ban.delete({ id: ban.id });

    const rejected = await Q.vote.mod.findAll({
      curseforgeProjectId: projectId,
      status: "rejected",
    });
    void announceUnban(rejected);
  }

  /** All bans with cached project info for display. */
  async listBans(): Promise<
    Array<{
      ban: Awaited<ReturnType<typeof Q.vote.mod.ban.findAll>>[number];
      project: VoteProjectSummary | null;
    }>
  > {
    const bans = await Q.vote.mod.ban.findAll(
      {},
      { orderBy: "createdAt", orderDirection: "desc" },
    );
    if (bans.length === 0) return [];

    const projects = await Q.curseforge.project.findAll({
      id: { $in: bans.map((b) => b.curseforgeProjectId) },
    });
    const byId = new Map(projects.map((p) => [p.id, p]));
    return bans.map((ban) => {
      const project = byId.get(ban.curseforgeProjectId);
      return {
        ban,
        project: project ? this.toProjectSummary(project) : null,
      };
    });
  }

  /** Dependency-pulled mods and aggregated optional deps, for the admin report. */
  async getDependencyReport(voteId: number): Promise<VoteDependencyReport> {
    await this.getVote(voteId);
    const mods = await Q.vote.mod.findAll({ voteId });
    const byId = new Map(mods.map((m) => [m.id, m]));
    const projects =
      mods.length > 0
        ? await Q.curseforge.project.findAll({
            id: { $in: [...new Set(mods.map((m) => m.curseforgeProjectId))] },
          })
        : [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const modName = (mod: VoteMod) =>
      projectById.get(mod.curseforgeProjectId)?.name ??
      `#${mod.curseforgeProjectId}`;

    const pulledItems = await this.decorateMods(
      mods.filter((m) => m.source === "dependency"),
    );
    const pulled = pulledItems.map((item) => {
      const puller = item.pulledByVoteModId
        ? byId.get(item.pulledByVoteModId)
        : undefined;
      return {
        ...item,
        pulledBy: puller
          ? { voteModId: puller.id, name: modName(puller) }
          : null,
      };
    });

    const liveMods = mods.filter((m) =>
      USER_VISIBLE_MOD_STATUSES.includes(m.status),
    );
    const optionalRows =
      liveMods.length > 0
        ? await Q.vote.mod.dependency.findAll({
            voteModId: { $in: liveMods.map((m) => m.id) },
            relationType: OPTIONAL_DEPENDENCY,
          })
        : [];
    const claimedProjectIds = new Set(
      liveMods.map((m) => m.curseforgeProjectId),
    );
    const optionalIds = [
      ...new Set(optionalRows.map((d) => d.curseforgeProjectId)),
    ];
    const [optionalProjects, optionalBans] = await Promise.all([
      optionalIds.length > 0
        ? Q.curseforge.project.findAll({ id: { $in: optionalIds } })
        : Promise.resolve([]),
      optionalIds.length > 0
        ? Q.vote.mod.ban.findAll({
            curseforgeProjectId: { $in: optionalIds },
          })
        : Promise.resolve([]),
    ]);
    const optionalProjectById = new Map(optionalProjects.map((p) => [p.id, p]));
    const optionalBannedIds = new Set(
      optionalBans.map((b) => b.curseforgeProjectId),
    );

    const optional = optionalIds
      .map((id) => {
        const project = optionalProjectById.get(id);
        return {
          curseforgeProjectId: id,
          name: project?.name ?? null,
          slug: project?.slug ?? null,
          thumbnailUrl: project?.thumbnailUrl ?? null,
          banned: optionalBannedIds.has(id),
          inVote: claimedProjectIds.has(id),
          wantedBy: optionalRows
            .filter((d) => d.curseforgeProjectId === id)
            .map((d) => byId.get(d.voteModId))
            .filter((m): m is VoteMod => m !== undefined)
            .map((m) => ({ voteModId: m.id, name: modName(m) })),
        };
      })
      .sort((a, b) => b.wantedBy.length - a.wantedBy.length);

    return { pulled, optional };
  }

  /** Bans for the public "ruled out" list; never exposes who banned. */
  async listPublicBans(): Promise<
    Array<{
      curseforgeProjectId: number;
      reason: string | null;
      createdAt: Date;
      project: VoteProjectSummary | null;
    }>
  > {
    const bans = await this.listBans();
    return bans.map(({ ban, project }) => ({
      curseforgeProjectId: ban.curseforgeProjectId,
      reason: ban.reason,
      createdAt: ban.createdAt,
      project,
    }));
  }

  private async getVoteSummary(voteId: number): Promise<VoteSummary> {
    const [approvedModCount, pendingModCount, participantIds, mods] =
      await Promise.all([
        Q.vote.mod.count({ voteId, status: "approved" }),
        Q.vote.mod.count({ voteId, status: "pending" }),
        Q.vote.participantDiscordIds(voteId),
        this.getVoteMods(voteId),
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
        voteModId: mod.id,
        name: mod.project.name,
        primaryAuthor: mod.project.primaryAuthor,
        upvoteCount: mod.upvoteCount,
        thumbnailUrl: mod.project.thumbnailUrl,
      }));

    return {
      approvedModCount,
      pendingModCount,
      participantCount: participantIds.length,
      participantSample,
      topMods,
    };
  }

  private assertUserVisible(vote: Vote): void {
    if (vote.status === "draft" || vote.status === "archived") {
      throw new NotFoundError(`Vote #${vote.id} not found`);
    }
  }

  private async getOpenVote(voteId: number): Promise<Vote> {
    const vote = await this.getVote(voteId);
    if (vote.status !== "open") {
      throw new BadRequestError("This workshop is not open for suggestions");
    }
    return vote;
  }

  private async decorateMods(mods: VoteMod[]): Promise<VoteModListItem[]> {
    if (mods.length === 0) return [];

    const projectIds = [...new Set(mods.map((m) => m.curseforgeProjectId))];
    const submitterIds = [...new Set(mods.map((m) => m.submittedBy))];
    const [projects, upvoteCounts, submitters, depRows] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: projectIds } }),
      Q.vote.mod.upvote.countGroupedByMod(mods.map((m) => m.id)),
      Q.player.findAll({ discordId: { $in: submitterIds } }),
      Q.vote.mod.dependency.findAll({
        voteModId: { $in: mods.map((m) => m.id) },
      }),
    ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const nameByDiscordId = new Map(
      submitters.map((p) => [p.discordId, p.minecraftUsername]),
    );
    const depsByMod = await this.buildDependencyInfo(depRows);

    return mods.flatMap((mod) => {
      const project = byId.get(mod.curseforgeProjectId);
      if (!project) return [];
      return [
        {
          ...mod,
          project: this.toProjectSummary(project),
          upvoteCount: upvoteCounts[mod.id] ?? 0,
          submitterName: nameByDiscordId.get(mod.submittedBy) ?? null,
          discordThreadUrl: mod.discordThreadId
            ? discordThreadUrl(mod.discordThreadId)
            : null,
          dependencies: depsByMod.get(mod.id) ?? [],
        },
      ];
    });
  }

  private async buildDependencyInfo(
    depRows: Awaited<ReturnType<typeof Q.vote.mod.dependency.findAll>>,
  ): Promise<Map<number, VoteModDependencyInfo[]>> {
    const byMod = new Map<number, VoteModDependencyInfo[]>();
    if (depRows.length === 0) return byMod;

    const depProjectIds = [
      ...new Set(depRows.map((d) => d.curseforgeProjectId)),
    ];
    const [depProjects, depBans] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: depProjectIds } }),
      Q.vote.mod.ban.findAll({
        curseforgeProjectId: { $in: depProjectIds },
      }),
    ]);
    const projectById = new Map(depProjects.map((p) => [p.id, p]));
    const bannedIds = new Set(depBans.map((b) => b.curseforgeProjectId));

    for (const dep of depRows) {
      const project = projectById.get(dep.curseforgeProjectId);
      const info: VoteModDependencyInfo = {
        curseforgeProjectId: dep.curseforgeProjectId,
        relationType: dep.relationType,
        name: project?.name ?? null,
        slug: project?.slug ?? null,
        thumbnailUrl: project?.thumbnailUrl ?? null,
        banned: bannedIds.has(dep.curseforgeProjectId),
      };
      const list = byMod.get(dep.voteModId) ?? [];
      list.push(info);
      byMod.set(dep.voteModId, list);
    }
    return byMod;
  }

  private toProjectSummary(project: CurseforgeProject): VoteProjectSummary {
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
   * entries carrying the file snapshot for the vote's target.
   */
  private async prepareEntries(
    vote: Vote,
    entries: VoteModEntry[],
  ): Promise<PreparedEntry[]> {
    if (entries.length === 0) return [];

    const projectIds = entries.map((e) => e.projectId);
    if (new Set(projectIds).size !== projectIds.length) {
      throw new BadRequestError("The request contains duplicate mods");
    }

    const [bans, claims] = await Promise.all([
      Q.vote.mod.ban.findAll({ curseforgeProjectId: { $in: projectIds } }),
      Q.vote.mod.findAll({
        voteId: vote.id,
        curseforgeProjectId: { $in: projectIds },
        status: { $in: USER_VISIBLE_MOD_STATUSES },
      }),
    ]);
    if (bans.length > 0) {
      const labels = await this.projectLabels(
        bans.map((b) => b.curseforgeProjectId),
      );
      throw new BadRequestError(
        `Rejected mods cannot be submitted: ${labels.join(", ")}`,
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

    if (vote.baseModpackProjectId) {
      let basePackIds: Set<number>;
      try {
        basePackIds = await getModpackModIds(vote.baseModpackProjectId);
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
      if (data.classId !== vote.classId) {
        throw new BadRequestError(
          `"${data.name}" is not the right kind of CurseForge project for this vote`,
        );
      }
      prepared.push({
        projectId: entry.projectId,
        note: entry.note ?? null,
        ...this.snapshotFile(vote, data),
      });
    }
    return prepared;
  }

  /** Pick the latest compatible file for the vote's game version and loader. */
  private snapshotFile(
    vote: Vote,
    data: CurseForgeProjectData,
  ): Omit<PreparedEntry, "projectId" | "note"> {
    let index = data.latestFilesIndexes.find(
      (idx) =>
        idx.gameVersion === vote.gameVersion &&
        idx.modLoader === vote.modLoaderType,
    );
    if (!index && vote.classId !== CurseForgeClass.mods) {
      index = data.latestFilesIndexes.find(
        (idx) => idx.gameVersion === vote.gameVersion,
      );
    }
    if (!index) {
      throw new BadRequestError(
        `"${data.name}" has no file for ${vote.gameVersion} with the vote's mod loader`,
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
    vote: Vote,
    entry: PreparedEntry,
    options: {
      submittedBy: string;
      source?: VoteMod["source"];
      status?: VoteModStatus;
      reviewedBy?: string;
    },
  ): Promise<VoteMod> {
    return tx.vote.mod.createAndReturn({
      voteId: vote.id,
      curseforgeProjectId: entry.projectId,
      source: options.source ?? "user",
      submittedBy: options.submittedBy,
      status: options.status ?? "pending",
      note: entry.note,
      reviewedBy: options.reviewedBy ?? null,
      reviewedAt: options.reviewedBy ? new Date() : null,
      fileId: entry.fileId,
      fileName: entry.fileName,
      fileReleaseType: entry.fileReleaseType,
    });
  }

  /**
   * Upsert the ban row and reject every pending or approved instance.
   * Returns the rows that were live before the sweep.
   */
  private async applyBan(
    tx: TxQueries,
    projectId: number,
    adminId: string,
    reason?: string,
  ): Promise<VoteMod[]> {
    const existing = await tx.vote.mod.ban.find({
      curseforgeProjectId: projectId,
    });
    if (!existing) {
      await tx.vote.mod.ban.create({
        curseforgeProjectId: projectId,
        bannedBy: adminId,
        reason: reason ?? null,
      });
    }

    const affected = await tx.vote.mod.findAll({
      curseforgeProjectId: projectId,
      status: { $in: USER_VISIBLE_MOD_STATUSES },
    });
    if (affected.length > 0) {
      await tx.vote.mod.updateAll(
        { status: "rejected", reviewedBy: adminId, reviewedAt: new Date() },
        {
          curseforgeProjectId: projectId,
          status: { $in: USER_VISIBLE_MOD_STATUSES },
        },
      );
    }
    return affected;
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
        "Someone else changed this vote at the same time, refresh and try again",
      );
    }
    throw error;
  }
}

export const voteService = new VoteService();
