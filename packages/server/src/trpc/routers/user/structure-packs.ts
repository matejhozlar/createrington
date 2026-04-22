import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import type { StructurePackRotationService } from "@/services/structure-pack/rotation";

async function getRotationService(): Promise<StructurePackRotationService> {
  return getService(Services.STRUCTURE_PACK_ROTATION);
}

export const userStructurePacksRouter = router({
  boost: userProcedure
    .meta({ description: "Purchase boost units for a structure pack" })
    .input(
      z.object({
        packId: z.number().int().positive(),
        units: z.number().int().positive().max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = await getRotationService();
      return service.purchaseBoost(
        ctx.user.discordId,
        input.packId,
        input.units,
      );
    }),

  myBoosts: userProcedure
    .meta({ description: "Get your boosts for the current rotation cycle" })
    .query(async ({ ctx }) => {
      const service = await getRotationService();
      return service.getPlayerBoosts(ctx.user.discordId);
    }),
});
