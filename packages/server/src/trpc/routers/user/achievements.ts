import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import { trpcError } from "@/trpc/utils";

/** User achievements router — progress tracking, single/bulk reward claims. */
export const achievementsRouter = router({
  getProgress: userProcedure
    .meta({
      description:
        "Get achievement progress for the authenticated player on a server.",
    })
    .input(
      z.object({
        serverId: z.number().int().positive(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const service = await getService(Services.ACHIEVEMENT_SERVICE);
      return service.getProgress(ctx.user.minecraftUuid, input.serverId);
    }),

  claim: userProcedure
    .meta({
      description: "Claim reward for a single completed achievement tier.",
    })
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

  claimAll: userProcedure
    .meta({
      description:
        "Claim all unclaimed completed achievements for the authenticated player.",
    })
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
