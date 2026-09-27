import { router, adminProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { dateRangeWithMonthGranularity, optionalDateRange } from "./schemas";

/** Admin activity metrics: active players and session length */
export const activityMetricsRouter = router({
  getActivePlayers: adminProcedure
    .meta({
      description: "Get unique active player counts grouped by time period.",
    })
    .input(dateRangeWithMonthGranularity)
    .query(async ({ input }) => {
      return await metricsService.activity.getActivePlayers(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  getAverageSessionLength: adminProcedure
    .meta({ description: "Get average session length in seconds" })
    .input(optionalDateRange)
    .query(async ({ input }) => {
      return await metricsService.activity.getAverageSessionLength(
        input.start,
        input.end,
      );
    }),
});
