import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { z } from "zod";
import { dateRangeWithGranularity } from "./schemas";

/** Admin moderation metrics: bans, strikes, tickets, moderator leaderboard */
export const moderationMetricsRouter = router({
  getBansByPeriod: adminProcedure
    .meta({ description: "Get ban counts grouped by time period" })
    .input(dateRangeWithGranularity)
    .query(async ({ input }) => {
      return await Q.player.ban.getCountsByPeriod(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  getStrikesByPeriod: adminProcedure
    .meta({
      description:
        "Get strike counts grouped by time period with classification breakdown",
    })
    .input(dateRangeWithGranularity)
    .query(async ({ input }) => {
      return await Q.player.strike.getCountsByPeriod(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  getStrikeSeverityDistribution: adminProcedure
    .meta({ description: "Get severity distribution for active strikes" })
    .query(async () => {
      return await Q.player.strike.getSeverityDistribution();
    }),

  getTicketOverview: adminProcedure
    .meta({
      description:
        "Get ticket overview: total, open, closed, average resolution time",
    })
    .query(async () => {
      return await Q.ticket.getOverview();
    }),

  getTicketVolume: adminProcedure
    .meta({ description: "Get ticket volume grouped by time period" })
    .input(dateRangeWithGranularity)
    .query(async ({ input }) => {
      return await Q.ticket.getVolumeByPeriod(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  getTopModerators: adminProcedure
    .meta({ description: "Get top moderators ranked by ban count" })
    .input(z.object({ limit: z.number().int().min(1).max(100).default(10) }))
    .query(async ({ input }) => {
      return await Q.player.ban.getModeratorActivity(input.limit);
    }),
});
