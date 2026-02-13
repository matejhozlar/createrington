import { router, adminProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { dateRangeInput } from "./schemas";

/** Admin growth metrics — registrations, waitlist funnel, Discord member trends */
export const growthMetricsRouter = router({
  getOverview: adminProcedure
    .meta({ description: "Get growth overview with total player count." })
    .query(async () => {
      return await metricsService.growth.getOverview();
    }),

  getRegistrations: adminProcedure
    .meta({ description: "Get player registrations grouped by time period." })
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return await metricsService.growth.getRegistrations(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),

  getWaitlistFunnel: adminProcedure
    .meta({ description: "Get waitlist funnel statistics." })
    .query(async () => {
      return await metricsService.growth.getWaitlistFunnel();
    }),

  getDiscordGrowth: adminProcedure
    .meta({ description: "Get Discord server growth (joins and leaves) by period." })
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return await metricsService.growth.getDiscordGrowth(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),
});
