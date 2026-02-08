import { router, publicProcedure } from "../../../trpc";
import { metricsService } from "@/services/metrics";
import { z } from "zod";

export const playtimeRouter = router({
  getTotalHours: publicProcedure
    .input(
      z.object({
        serverId: z.coerce.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      const totalHours = await metricsService.playtime.getTotalHours(
        input.serverId,
      );

      return {
        serverId: input.serverId ?? null,
        totalHours,
      };
    }),

  getHoursBreakdown: publicProcedure.query(async () => {
    const breakdown = await metricsService.playtime.getTotalHoursBreakdown();
    return breakdown;
  }),
});
