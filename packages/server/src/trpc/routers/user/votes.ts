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
        return { vote, mods };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  getMod: votingProcedure
    .meta({ description: "Get a mod with its full project detail" })
    .input(z.object({ voteModId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await voteService.getModDetail(input.voteModId);
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
        return await voteService.getActiveSubmission(
          input.voteId,
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
        return await voteService.createSubmission(
          input.voteId,
          ctx.user.discordId,
          input.mods,
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
        return await voteService.updateSubmission(
          input.voteId,
          ctx.user.discordId,
          input.mods,
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
