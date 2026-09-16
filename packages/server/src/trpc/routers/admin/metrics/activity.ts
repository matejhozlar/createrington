import { router, adminProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import {
  dateRange,
  dateRangeWithMonthGranularity,
  optionalDateRange,
} from "./schemas";

/** Admin activity metrics: active players, peak concurrent, sessions, retention */
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

  getPeakConcurrent: adminProcedure
    .meta({
      description: "Get peak concurrent player count within a time range.",
    })
    .input(dateRange)
    .query(async ({ input }) => {
      return await metricsService.activity.getPeakConcurrent(
        input.start,
        input.end,
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

  getNewVsReturning: adminProcedure
    .meta({ description: "Get new vs returning players per day" })
    .input(dateRange)
    .query(async ({ input }) => {
      return await metricsService.activity.getNewVsReturning(
        input.start,
        input.end,
      );
    }),
});
