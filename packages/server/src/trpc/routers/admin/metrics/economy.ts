import { router, adminProcedure } from "@/trpc/trpc";
import { metricsService } from "@/services/metrics";
import { z } from "zod";
import { dateRangeInput } from "./schemas";

/** Admin economy metrics: overview, distribution, transactions, top balances */
export const economyMetricsRouter = router({
  getOverview: adminProcedure
    .meta({
      description:
        "Get economy overview: total balance, player count, average balance",
    })
    .query(async () => {
      return await metricsService.economy.getOverview();
    }),

  getDistribution: adminProcedure
    .meta({ description: "Get balance distribution across predefined ranges" })
    .query(async () => {
      return await metricsService.economy.getDistribution();
    }),

  getTransactionVolume: adminProcedure
    .meta({ description: "Get transaction volume grouped by time period" })
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return await metricsService.economy.getTransactionVolume(
        new Date(input.start),
        new Date(input.end),
        input.granularity,
      );
    }),

  getTopBalances: adminProcedure
    .meta({ description: "Get top players by balance" })
    .input(z.object({ limit: z.number().int().min(1).max(100).default(10) }))
    .query(async ({ input }) => {
      return await metricsService.economy.getTopBalances(input.limit);
    }),
});
