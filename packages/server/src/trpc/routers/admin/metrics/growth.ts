import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { metricsService } from "@/services/metrics";
import { dateRangeWithGranularity } from "./schemas";

export const growthMetricsRouter = router({
  overview: adminProcedure
    .meta({ description: "Get growth overview with total player count" })
    .query(async () => {
      return { totalPlayers: await Q.player.count() };
    }),

  registrations: adminProcedure
    .meta({ description: "Get player registrations grouped by time period" })
    .input(dateRangeWithGranularity)
    .query(async ({ input }) => {
      return await Q.player.getRegistrationsByPeriod(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  waitlistFunnel: adminProcedure
    .meta({ description: "Get waitlist funnel statistics" })
    .query(async () => {
      return await Q.waitlist.entry.getFunnelStats();
    }),

  discordGrowth: adminProcedure
    .meta({
      description: "Get Discord server growth (joins and leaves) by period.",
    })
    .input(dateRangeWithGranularity)
    .query(async ({ input }) => {
      return await metricsService.getDiscordGrowth(
        input.start,
        input.end,
        input.granularity,
      );
    }),
});
