import { router, adminProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { z } from "zod";
import { dateRangeWithMonthInput } from "./schemas";

/** Admin activity metrics — active players, peak concurrent, sessions, retention */
export const activityMetricsRouter = router({
  getActivePlayers: adminProcedure
    .meta({
      description: "Get unique active player counts grouped by time period.",
    })
    .input(dateRangeWithMonthInput)
    .query(async ({ input }) => {
      return await metricsService.activity.getActivePlayers(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),

  getPeakConcurrent: adminProcedure
    .meta({
      description: "Get peak concurrent player count within a time range.",
    })
    .input(z.object({ start: z.iso.datetime(), end: z.iso.datetime() }))
    .query(async ({ input }) => {
      return await metricsService.activity.getPeakConcurrent(
        new Date(input.start),
        new Date(input.end),
      );
    }),

  getAverageSessionLength: adminProcedure
    .meta({ description: "Get average session length in seconds." })
    .input(
      z.object({
        start: z.iso.datetime().optional(),
        end: z.iso.datetime().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await metricsService.activity.getAverageSessionLength(
        input.start ? new Date(input.start) : undefined,
        input.end ? new Date(input.end) : undefined,
      );
    }),

  getNewVsReturning: adminProcedure
    .meta({ description: "Get new vs returning players per day." })
    .input(z.object({ start: z.iso.datetime(), end: z.iso.datetime() }))
    .query(async ({ input }) => {
      return await metricsService.activity.getNewVsReturning(
        new Date(input.start),
        new Date(input.end),
      );
    }),
});
