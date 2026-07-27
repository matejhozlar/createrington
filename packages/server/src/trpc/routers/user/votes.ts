import { z } from "zod";
import { router, userProcedure, middleware } from "@/trpc/trpc";
import { trpcError, rethrowTrpc } from "@/trpc/utils";
import { voteService } from "@/services/vote";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";

const requireVotingEnabled = middleware(async ({ next }) => {
  if (!(await featureFlagService.isEnabled(FeatureFlags.voting))) {
    throw trpcError.forbidden("Voting is currently disabled");
  }
  return next();
});

const votingProcedure = userProcedure.use(requireVotingEnabled);

function redactMod<T extends { reviewedBy: string | null }>(
  mod: T,
): Omit<T, "reviewedBy"> {
  const { reviewedBy: _reviewedBy, ...rest } = mod;
  return rest;
}

function redactSubmission<
  T extends { mods: Array<{ reviewedBy: string | null }> },
>(
  detail: T,
): Omit<T, "mods"> & { mods: Omit<T["mods"][number], "reviewedBy">[] } {
  return {
    ...detail,
    mods: detail.mods.map((m) => redactMod(m)) as Omit<
      T["mods"][number],
      "reviewedBy"
    >[],
  };
}

const submissionEntries = z
  .array(
    z.object({
      projectId: z.number().int().positive(),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .min(1)
  .max(25);

export const userVotesRouter = router({
  enabled: userProcedure
    .meta({ description: "Whether the voting feature is enabled" })
    .query(async () => ({
      enabled: await featureFlagService.isEnabled(FeatureFlags.voting),
    })),

  list: votingProcedure
    .meta({ description: "List open and closed votes" })
    .query(() => voteService.listVisibleVotes()),

  get: votingProcedure
    .meta({ description: "Get a vote with its visible mods by slug" })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      try {
        const vote = await voteService.getVisibleVoteBySlug(input.slug);
        const mods = await voteService.getVoteMods(vote.id);
        return { vote, mods: mods.map((m) => redactMod(m)) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getMod: votingProcedure
    .meta({ description: "Get a mod with its full project detail" })
    .input(z.object({ voteModId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        const detail = await voteService.getModDetail(input.voteModId);
        return { ...detail, mod: redactMod(detail.mod) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  searchProjects: votingProcedure
    .meta({ description: "Search CurseForge for submittable projects" })
    .input(
      z.object({
        voteId: z.number().int().positive(),
        query: z.string().trim().min(2).max(100),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await voteService.searchProjects(input.voteId, input.query, {
          userVisible: true,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  mySubmission: votingProcedure
    .meta({ description: "Get your active submission for a vote" })
    .input(z.object({ voteId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        const detail = await voteService.getActiveSubmission(
          input.voteId,
          ctx.user.discordId,
        );
        return detail ? redactSubmission(detail) : null;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  myUpvotes: votingProcedure
    .meta({ description: "IDs of mods and submissions you have upvoted" })
    .input(z.object({ voteId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await voteService.getMyUpvotes(input.voteId, ctx.user.discordId);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  upvoteMod: votingProcedure
    .meta({ description: "Toggle your upvote on a mod" })
    .input(z.object({ voteModId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await voteService.toggleModUpvote(
          input.voteModId,
          ctx.user.discordId,
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  upvoteSubmission: votingProcedure
    .meta({ description: "Toggle your upvote on a submission" })
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await voteService.toggleSubmissionUpvote(
          input.submissionId,
          ctx.user.discordId,
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  createSubmission: votingProcedure
    .meta({ description: "Create your submission for a vote" })
    .input(
      z.object({
        voteId: z.number().int().positive(),
        mods: submissionEntries,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return redactSubmission(
          await voteService.createSubmission(
            input.voteId,
            ctx.user.discordId,
            input.mods,
          ),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  updateSubmission: votingProcedure
    .meta({ description: "Update your active submission's mod set" })
    .input(
      z.object({
        voteId: z.number().int().positive(),
        mods: submissionEntries,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return redactSubmission(
          await voteService.updateSubmission(
            input.voteId,
            ctx.user.discordId,
            input.mods,
          ),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  withdrawSubmission: votingProcedure
    .meta({ description: "Withdraw your active submission" })
    .input(z.object({ voteId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await voteService.withdrawSubmission(input.voteId, ctx.user.discordId);
        return { withdrawn: true };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
