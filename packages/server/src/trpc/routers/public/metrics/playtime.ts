import { router, publicProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { coercedId } from "@/trpc/utils";
import { z } from "zod";

export const playtimeRouter = router({
  totalHours: publicProcedure
    .meta({
      description:
        "Returns total playtime hours across all players, including hours archived from retired seasons. Optionally filter by serverId for a single server's hours, which excludes the archive. Used for the 'Hours Played' metric on the home page",
    })
    .input(
      z.object({
        serverId: coercedId().optional(),
      }),
    )
    .query(async ({ input }) => {
      const totalHours = await metricsService.getTotalHours(input.serverId);

      return {
        serverId: input.serverId ?? null,
        totalHours,
      };
    }),

  hoursBreakdown: publicProcedure
    .meta({
      description:
        "Returns a breakdown of total playtime hours per live server, plus the hours archived from retired seasons and the combined total. Useful for comparing activity across servers",
    })
    .query(async () => {
      return await metricsService.getHoursBreakdown();
    }),
});
