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
  VoteSubmission,
} from "@createrington/shared/db";
import {
  CurseForgeClass,
  getMod,
  getModpackModIds,
  searchMods,
  type CurseForgeProjectData,
} from "@/services/curseforge";
import { ingestProject } from "@/services/curseforge/ingest";

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

export interface VoteModListItem extends VoteMod {
  project: VoteProjectSummary;
  upvoteCount: number;
  submitterName: string | null;
}

export interface VoteSubmissionDetail {
  submission: VoteSubmission;
  upvoteCount: number;
  mods: VoteModListItem[];
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
      throw new NotFoundError(`Vote "${slug}" not found`);
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
    mod: VoteMod & { submitterName: string | null };
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
    const [project, upvoteCount, submitter] = await Promise.all([
      Q.curseforge.project.get({ id: mod.curseforgeProjectId }),
      Q.vote.mod.upvote.count({ voteModId }),
      Q.player.find({ discordId: mod.submittedBy }),
    ]);
    return {
      mod: { ...mod, submitterName: submitter?.minecraftUsername ?? null },
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

  /** The caller's active submission in a vote, or null. */
  async getActiveSubmission(
    voteId: number,
    discordId: string,
  ): Promise<VoteSubmissionDetail | null> {
    const submission = await this.findActiveSubmission(voteId, discordId);
    if (!submission) return null;
    return this.getSubmissionDetail(submission);
  }

  /** Create the caller's submission with up to the vote's per-submission cap. */
  async createSubmission(
    voteId: number,
    discordId: string,
    entries: VoteModEntry[],
  ): Promise<VoteSubmissionDetail> {
    const vote = await this.getOpenVote(voteId);
    if (entries.length === 0) {
      throw new BadRequestError("A submission needs at least one mod");
    }
    if (entries.length > vote.maxModsPerSubmission) {
      throw new BadRequestError(
        `A submission can hold at most ${vote.maxModsPerSubmission} mods`,
      );
    }

    const existing = await this.findActiveSubmission(voteId, discordId);
    if (existing) {
      throw new ConflictError(
        "You already have an active submission for this vote",
      );
    }

    const prepared = await this.prepareEntries(vote, entries);

    try {
      const submission = await db.inTransaction(async (tx) => {
        const created = await tx.vote.submission.createAndReturn({
          voteId,
          discordId,
        });
        for (const entry of prepared) {
          await this.createMod(tx, vote, entry, {
            submissionId: created.id,
            submittedBy: discordId,
          });
        }
        return created;
      });
      return (await this.getSubmissionDetail(submission))!;
    } catch (error) {
      this.mapConstraintError(error);
    }
  }

  /**
   * Reconcile the caller's active submission to the given mod set. Pending
   * mods absent from the set are removed, new ones are validated and added,
   * notes on kept pending mods are updated. Reviewed mods are untouched.
   */
  async updateSubmission(
    voteId: number,
    discordId: string,
    entries: VoteModEntry[],
  ): Promise<VoteSubmissionDetail> {
    const vote = await this.getOpenVote(voteId);
    const submission = await this.findActiveSubmission(voteId, discordId);
    if (!submission) {
      throw new NotFoundError("You have no active submission for this vote");
    }

    const current = await Q.vote.mod.findAll({ submissionId: submission.id });
    const activeByProject = new Map(
      current
        .filter((m) => USER_VISIBLE_MOD_STATUSES.includes(m.status))
        .map((m) => [m.curseforgeProjectId, m]),
    );
    const desired = new Map(entries.map((e) => [e.projectId, e]));
    if (desired.size !== entries.length) {
      throw new BadRequestError("A submission cannot contain duplicate mods");
    }

    const toRemove = [...activeByProject.values()].filter(
      (m) => m.status === "pending" && !desired.has(m.curseforgeProjectId),
    );
    const toAdd = entries.filter((e) => !activeByProject.has(e.projectId));
    const noteUpdates = entries.filter((e) => {
      const existing = activeByProject.get(e.projectId);
      return (
        existing &&
        existing.status === "pending" &&
        (e.note ?? null) !== existing.note
      );
    });

    const keptCount = activeByProject.size - toRemove.length;
    if (keptCount + toAdd.length > vote.maxModsPerSubmission) {
      throw new BadRequestError(
        `A submission can hold at most ${vote.maxModsPerSubmission} mods`,
      );
    }
    if (keptCount + toAdd.length === 0) {
      throw new BadRequestError(
        "A submission needs at least one mod, withdraw it instead",
      );
    }

    const prepared = await this.prepareEntries(vote, toAdd);

    try {
      await db.inTransaction(async (tx) => {
        if (toRemove.length > 0) {
          await tx.vote.mod.deleteAll({
            id: { $in: toRemove.map((m) => m.id) },
          });
        }
        for (const entry of prepared) {
          await this.createMod(tx, vote, entry, {
            submissionId: submission.id,
            submittedBy: discordId,
          });
        }
        for (const entry of noteUpdates) {
          const existing = activeByProject.get(entry.projectId)!;
          await tx.vote.mod.update(
            { id: existing.id },
            { note: entry.note ?? null },
          );
        }
        await tx.vote.submission.update(
          { id: submission.id },
          { updatedAt: new Date() },
        );
      });
    } catch (error) {
      this.mapConstraintError(error);
    }

    return (await this.getSubmissionDetail(submission))!;
  }

  /**
   * Withdraw the caller's active submission. Pending mods are removed;
   * reviewed mods stay for credit and the submission closes, or is deleted
   * entirely when nothing was reviewed yet.
   */
  async withdrawSubmission(voteId: number, discordId: string): Promise<void> {
    await this.getOpenVote(voteId);
    const submission = await this.findActiveSubmission(voteId, discordId);
    if (!submission) {
      throw new NotFoundError("You have no active submission for this vote");
    }

    await db.inTransaction(async (tx) => {
      await tx.vote.mod.deleteAll({
        submissionId: submission.id,
        status: "pending",
      });
      const remaining = await tx.vote.mod.count({
        submissionId: submission.id,
      });
      if (remaining === 0) {
        await tx.vote.submission.delete({ id: submission.id });
      } else {
        await tx.vote.submission.update(
          { id: submission.id },
          { status: "closed" },
        );
      }
    });
  }

  /** Toggle the caller's upvote on a visible mod in an open vote. */
  async toggleModUpvote(
    voteModId: number,
    discordId: string,
  ): Promise<{ upvoted: boolean; upvoteCount: number }> {
    const mod = await Q.vote.mod.find({ id: voteModId });
    if (!mod || !USER_VISIBLE_MOD_STATUSES.includes(mod.status)) {
      throw new NotFoundError(`Mod #${voteModId} not found`);
    }
    await this.getOpenVote(mod.voteId);
    if (mod.submittedBy === discordId) {
      throw new BadRequestError("You cannot upvote your own suggestion");
    }

    const existing = await Q.vote.mod.upvote.find({ voteModId, discordId });
    let upvoted: boolean;
    if (existing) {
      await Q.vote.mod.upvote.deleteAll({ id: existing.id });
      upvoted = false;
    } else {
      try {
        await Q.vote.mod.upvote.create({ voteModId, discordId });
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
      upvoted = true;
    }

    const upvoteCount = await Q.vote.mod.upvote.count({ voteModId });
    return { upvoted, upvoteCount };
  }

  /** Toggle the caller's upvote on another player's active submission. */
  async toggleSubmissionUpvote(
    submissionId: number,
    discordId: string,
  ): Promise<{ upvoted: boolean; upvoteCount: number }> {
    const submission = await Q.vote.submission.find({ id: submissionId });
    if (!submission || submission.status !== "active") {
      throw new NotFoundError(`Submission #${submissionId} not found`);
    }
    await this.getOpenVote(submission.voteId);
    if (submission.discordId === discordId) {
      throw new BadRequestError("You cannot upvote your own submission");
    }

    const existing = await Q.vote.submission.upvote.find({
      submissionId,
      discordId,
    });
    let upvoted: boolean;
    if (existing) {
      await Q.vote.submission.upvote.deleteAll({ id: existing.id });
      upvoted = false;
    } else {
      try {
        await Q.vote.submission.upvote.create({ submissionId, discordId });
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
      }
      upvoted = true;
    }

    const upvoteCount = await Q.vote.submission.upvote.count({ submissionId });
    return { upvoted, upvoteCount };
  }

  /** IDs of the mods and submissions in a vote the caller has upvoted. */
  async getMyUpvotes(
    voteId: number,
    discordId: string,
  ): Promise<{ modIds: number[]; submissionIds: number[] }> {
    const mods = await Q.vote.mod.findAll({ voteId }, { select: ["id"] });
    const modIds = mods.map((m) => m.id);
    const modUpvotes =
      modIds.length > 0
        ? await Q.vote.mod.upvote.findAll({
            discordId,
            voteModId: { $in: modIds },
          })
        : [];

    const submissions = await Q.vote.submission.findAll(
      { voteId },
      { select: ["id"] },
    );
    const submissionIds = submissions.map((s) => s.id);
    const submissionUpvotes =
      submissionIds.length > 0
        ? await Q.vote.submission.upvote.findAll({
            discordId,
            submissionId: { $in: submissionIds },
          })
        : [];

    return {
      modIds: modUpvotes.map((u) => u.voteModId),
      submissionIds: submissionUpvotes.map((u) => u.submissionId),
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
      maxModsPerSubmission?: number;
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

    try {
      return await Q.vote.createAndReturn({
        name: input.name,
        slug,
        description: input.description ?? null,
        gameVersion: input.gameVersion,
        modLoaderType: input.modLoaderType,
        classId: input.classId ?? CurseForgeClass.mods,
        baseModpackProjectId: input.baseModpackProjectId ?? null,
        maxModsPerSubmission: input.maxModsPerSubmission ?? 5,
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
      maxModsPerSubmission: number;
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

    return Q.vote.updateAndReturn({ id: voteId }, patch);
  }

  /** Review a pending or previously reviewed mod: approve, decline, or reject (global ban). */
  async reviewMod(
    voteModId: number,
    action: VoteReviewAction,
    adminId: string,
    reason?: string,
  ): Promise<VoteMod> {
    const mod = await Q.vote.mod.find({ id: voteModId });
    if (!mod) throw new NotFoundError(`Mod #${voteModId} not found`);

    const ban = await Q.vote.mod.ban.find({
      curseforgeProjectId: mod.curseforgeProjectId,
    });
    if (ban && action !== "reject") {
      throw new BadRequestError("This project is banned, remove the ban first");
    }

    try {
      return await db.inTransaction(async (tx) => {
        if (action === "reject") {
          await this.applyBan(tx, mod.curseforgeProjectId, adminId, reason);
          if (mod.status === "declined") {
            await tx.vote.mod.update(
              { id: voteModId },
              {
                status: "rejected",
                reviewedBy: adminId,
                reviewedAt: new Date(),
              },
            );
          }
          return tx.vote.mod.get({ id: voteModId });
        }

        const updated = await tx.vote.mod.updateAndReturn(
          { id: voteModId },
          {
            status: action === "approve" ? "approved" : "declined",
            reviewedBy: adminId,
            reviewedAt: new Date(),
          },
        );
        if (mod.submissionId) {
          await this.closeSubmissionIfSettled(tx, mod.submissionId);
        }
        return updated;
      });
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
            submissionId: null,
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
    return this.decorateMods(mods);
  }

  /** Globally ban a project and reject every live instance of it. */
  async banProject(
    projectId: number,
    adminId: string,
    reason?: string,
  ): Promise<void> {
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

    await db.inTransaction(async (tx) => {
      await this.applyBan(tx, projectId, adminId, reason);
    });
  }

  /** Lift a global ban. Rejected mod rows stay but become reviewable again. */
  async unbanProject(projectId: number): Promise<void> {
    const ban = await Q.vote.mod.ban.find({ curseforgeProjectId: projectId });
    if (!ban) {
      throw new NotFoundError(`Project #${projectId} is not banned`);
    }
    await Q.vote.mod.ban.delete({ id: ban.id });
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

  private async findActiveSubmission(
    voteId: number,
    discordId: string,
  ): Promise<VoteSubmission | null> {
    const [submission] = await Q.vote.submission.findAll(
      { voteId, discordId, status: "active" },
      { limit: 1 },
    );
    return submission ?? null;
  }

  private assertUserVisible(vote: Vote): void {
    if (vote.status === "draft" || vote.status === "archived") {
      throw new NotFoundError(`Vote #${vote.id} not found`);
    }
  }

  private async getOpenVote(voteId: number): Promise<Vote> {
    const vote = await this.getVote(voteId);
    if (vote.status !== "open") {
      throw new BadRequestError("This vote is not open for submissions");
    }
    return vote;
  }

  private async getSubmissionDetail(
    submission: VoteSubmission,
  ): Promise<VoteSubmissionDetail> {
    const fresh = await Q.vote.submission.get({ id: submission.id });
    const mods = await Q.vote.mod.findAll(
      { submissionId: submission.id },
      { orderBy: "createdAt", orderDirection: "asc" },
    );
    const counts = await Q.vote.submission.upvote.countGroupedBySubmission([
      submission.id,
    ]);
    return {
      submission: fresh,
      upvoteCount: counts[submission.id] ?? 0,
      mods: await this.decorateMods(mods),
    };
  }

  private async decorateMods(mods: VoteMod[]): Promise<VoteModListItem[]> {
    if (mods.length === 0) return [];

    const projectIds = [...new Set(mods.map((m) => m.curseforgeProjectId))];
    const submitterIds = [...new Set(mods.map((m) => m.submittedBy))];
    const [projects, upvoteCounts, submitters] = await Promise.all([
      Q.curseforge.project.findAll({ id: { $in: projectIds } }),
      Q.vote.mod.upvote.countGroupedByMod(mods.map((m) => m.id)),
      Q.player.findAll({ discordId: { $in: submitterIds } }),
    ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const nameByDiscordId = new Map(
      submitters.map((p) => [p.discordId, p.minecraftUsername]),
    );

    return mods.flatMap((mod) => {
      const project = byId.get(mod.curseforgeProjectId);
      if (!project) return [];
      return [
        {
          ...mod,
          project: this.toProjectSummary(project),
          upvoteCount: upvoteCounts[mod.id] ?? 0,
          submitterName: nameByDiscordId.get(mod.submittedBy) ?? null,
        },
      ];
    });
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
      throw new BadRequestError("A submission cannot contain duplicate mods");
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
        `Already in this vote or another submission: ${labels.join(", ")}`,
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
      submissionId: number | null;
      submittedBy: string;
      source?: VoteMod["source"];
      status?: VoteModStatus;
      reviewedBy?: string;
    },
  ): Promise<void> {
    await tx.vote.mod.create({
      voteId: vote.id,
      curseforgeProjectId: entry.projectId,
      submissionId: options.submissionId,
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

  /** Upsert the ban row and reject every pending or approved instance. */
  private async applyBan(
    tx: TxQueries,
    projectId: number,
    adminId: string,
    reason?: string,
  ): Promise<void> {
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
    if (affected.length === 0) return;

    await tx.vote.mod.updateAll(
      { status: "rejected", reviewedBy: adminId, reviewedAt: new Date() },
      {
        curseforgeProjectId: projectId,
        status: { $in: USER_VISIBLE_MOD_STATUSES },
      },
    );

    const submissionIds = [
      ...new Set(
        affected
          .map((m) => m.submissionId)
          .filter((id): id is number => id !== null),
      ),
    ];
    for (const submissionId of submissionIds) {
      await this.closeSubmissionIfSettled(tx, submissionId);
    }
  }

  /** Close a submission once none of its mods are pending, freeing the slot. */
  private async closeSubmissionIfSettled(
    tx: TxQueries,
    submissionId: number,
  ): Promise<void> {
    const pending = await tx.vote.mod.count({
      submissionId,
      status: "pending",
    });
    if (pending === 0) {
      await tx.vote.submission.update(
        { id: submissionId },
        { status: "closed" },
      );
    }
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
