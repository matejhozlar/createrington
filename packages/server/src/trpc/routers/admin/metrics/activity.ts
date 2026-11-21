import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { dateRangeWithMonthGranularity, optionalDateRange } from "./schemas";

export const activityMetricsRouter = router({
  activePlayers: adminProcedure
    .meta({
      description: "Get unique active player counts grouped by time period.",
    })
    .input(dateRangeWithMonthGranularity)
    .query(async ({ input }) => {
      return await Q.player.session.getActivePlayerCounts(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  averageSessionLength: adminProcedure
    .meta({ description: "Get average session length in seconds" })
    .input(optionalDateRange)
    .query(async ({ input }) => {
      return await Q.player.session.getAverageSessionLength(
        input.start,
        input.end,
      );
    }),
});
