import { router, publicProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { z } from "zod";

/** Public playtime metrics router — total hours and per-server breakdown. */
export const playtimeRouter = router({
  getTotalHours: publicProcedure
    .meta({
      description:
        "Returns total playtime hours across all players. Optionally filter by serverId to get hours for a specific server. Used for the 'Hours Played' metric on the home page.",
    })
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

  getHoursBreakdown: publicProcedure
    .meta({
      description:
        "Returns a breakdown of total playtime hours per server. Useful for comparing activity across servers.",
    })
    .query(async () => {
      const breakdown = await metricsService.playtime.getTotalHoursBreakdown();
      return breakdown;
    }),
});
