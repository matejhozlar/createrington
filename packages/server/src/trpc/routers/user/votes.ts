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

  mySuggestions: votingProcedure
    .meta({ description: "Your own suggestions in a vote, all statuses" })
    .input(z.object({ voteId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        const mods = await voteService.getMySuggestions(
          input.voteId,
          ctx.user.discordId,
        );
        return mods.map((m) => redactMod(m));
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  myUpvotes: votingProcedure
    .meta({ description: "IDs of mods you have upvoted" })
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

  suggestMod: votingProcedure
    .meta({ description: "Suggest a mod, using one of your slots" })
    .input(
      z.object({
        voteId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const mod = await voteService.suggestMod(
          input.voteId,
          ctx.user.discordId,
          { projectId: input.projectId, note: input.note },
        );
        return redactMod(mod);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  removeSuggestion: votingProcedure
    .meta({ description: "Remove your own pending suggestion" })
    .input(z.object({ voteModId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await voteService.removeSuggestion(input.voteModId, ctx.user.discordId);
        return { removed: true };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
