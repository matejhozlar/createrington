import { router, adminProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { z } from "zod";
import { dateRangeInput } from "./schemas";

/** Admin moderation metrics — bans, strikes, tickets, moderator leaderboard */
export const moderationMetricsRouter = router({
  getBansByPeriod: adminProcedure
    .meta({ description: "Get ban counts grouped by time period." })
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return await metricsService.moderation.getBansByPeriod(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),

  getStrikesByPeriod: adminProcedure
    .meta({ description: "Get strike counts grouped by time period with classification breakdown." })
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return await metricsService.moderation.getStrikesByPeriod(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),

  getStrikeSeverityDistribution: adminProcedure
    .meta({ description: "Get severity distribution for active strikes." })
    .query(async () => {
      return await metricsService.moderation.getStrikeSeverityDistribution();
    }),

  getTicketOverview: adminProcedure
    .meta({ description: "Get ticket overview: total, open, closed, average resolution time." })
    .query(async () => {
      return await metricsService.moderation.getTicketOverview();
    }),

  getTicketVolume: adminProcedure
    .meta({ description: "Get ticket volume grouped by time period." })
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return await metricsService.moderation.getTicketVolume(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),

  getTopModerators: adminProcedure
    .meta({ description: "Get top moderators ranked by ban count." })
    .input(z.object({ limit: z.number().int().min(1).max(100).default(10) }))
    .query(async ({ input }) => {
      return await metricsService.moderation.getTopModerators(input.limit);
    }),
});
