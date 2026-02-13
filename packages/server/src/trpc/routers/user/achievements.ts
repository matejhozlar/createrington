import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import { trpcError } from "@/trpc/utils";

export const achievementsRouter = router({
  /**
   * Get achievement progress for the authenticated player on a server.
   * Returns all achievement groups with current values and completed tiers.
   */
  getProgress: userProcedure
    .input(
      z.object({
        serverId: z.number().int().positive(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const service = await getService(Services.ACHIEVEMENT_SERVICE);
      return service.getProgress(ctx.user.minecraftUuid, input.serverId);
    }),

  /**
   * Claim reward for a single completed achievement tier.
   */
  claim: userProcedure
    .input(
      z.object({
        serverId: z.number().int().positive(),
        groupId: z.string().min(1),
        tier: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = await getService(Services.ACHIEVEMENT_SERVICE);

      try {
        return await service.claim(
          ctx.user.minecraftUuid,
          input.serverId,
          input.groupId,
          input.tier,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("No unclaimed achievement")
        ) {
          throw trpcError.notFound(error.message);
        }
        if (
          error instanceof Error &&
          error.message.includes("Unknown achievement group")
        ) {
          throw trpcError.badRequest(error.message);
        }
        throw error;
      }
    }),

  /**
   * Claim all unclaimed completed achievements for the authenticated player.
   */
  claimAll: userProcedure
    .input(
      z.object({
        serverId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = await getService(Services.ACHIEVEMENT_SERVICE);
      return service.claimAll(ctx.user.minecraftUuid, input.serverId);
    }),
});
