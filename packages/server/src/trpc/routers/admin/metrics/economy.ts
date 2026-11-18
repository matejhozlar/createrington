import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { metricsService } from "@/services/metrics";
import { z } from "zod";
import { dateRangeWithGranularity } from "./schemas";

export const economyMetricsRouter = router({
  getOverview: adminProcedure
    .meta({
      description:
        "Get economy overview: total balance, player count, average balance",
    })
    .query(async () => {
      return await metricsService.getEconomyOverview();
    }),

  getDistribution: adminProcedure
    .meta({ description: "Get balance distribution across predefined ranges" })
    .query(async () => {
      return await Q.player.balance.getDistribution();
    }),

  getTransactionVolume: adminProcedure
    .meta({ description: "Get transaction volume grouped by time period" })
    .input(dateRangeWithGranularity)
    .query(async ({ input }) => {
      return await Q.player.balance.transaction.getVolumeByPeriod(
        input.start,
        input.end,
        input.granularity,
      );
    }),

  getTopBalances: adminProcedure
    .meta({ description: "Get top players by balance" })
    .input(z.object({ limit: z.number().int().min(1).max(100).default(10) }))
    .query(async ({ input }) => {
      return await Q.player.balance.getTop(input.limit);
    }),
});
