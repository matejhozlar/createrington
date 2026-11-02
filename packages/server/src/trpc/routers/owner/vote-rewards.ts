import { Q } from "@/db";
import { settings, voteRewardCommandsSchema } from "@/services/settings";
import { ownerProcedure, router } from "@/trpc/trpc";
import { auditActor } from "@/trpc/utils";

export const ownerVoteRewardsRouter = router({
  update: ownerProcedure
    .meta({
      description:
        "Replace the console commands the vote payout runs; the next payout uses them",
    })
    .input(voteRewardCommandsSchema)
    .mutation(async ({ ctx, input }) => {
      await settings.setVoteRewardCommands(input, ctx.user.discordId);

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "vote_reward_commands_update",
        description: `Vote rewards set to ${input.perVote.length} per-vote and ${input.afterPayout.length} after-payout command(s): ${[...input.perVote, ...input.afterPayout].join(" | ")}`,
      });

      return settings.getVoteRewardCommands();
    }),
});
