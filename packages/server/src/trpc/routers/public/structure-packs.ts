import { router, publicProcedure } from "@/trpc/trpc";
import { structurePackService } from "@/services/structure-pack";
import { getService, Services } from "@/services";
import type { StructurePackRotationService } from "@/services/structure-pack/rotation";

async function getRotationService(): Promise<StructurePackRotationService> {
  return getService(Services.STRUCTURE_PACK_ROTATION);
}

export const publicStructurePacksRouter = router({
  current: publicProcedure
    .meta({ description: "Get the currently active structure pack" })
    .query(async () => {
      return structurePackService.getActivePack();
    }),

  pool: publicProcedure
    .meta({ description: "Get eligible packs with their current weights" })
    .query(async () => {
      const service = await getRotationService();
      return service.getPoolWithWeights();
    }),

  rotationInfo: publicProcedure
    .meta({
      description: "Get next scheduled rotation time and boost pricing config",
    })
    .query(async () => {
      const service = await getRotationService();
      return service.getNextRotationInfo();
    }),
});
