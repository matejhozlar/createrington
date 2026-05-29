import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";

export const cryptoMarketProcedures = {
  treasury: adminProcedure
    .meta({ description: "View market treasury (collected fees and burned)" })
    .query(async () => {
      const treasury = await Q.crypto.treasury.where({}).first();
      return {
        totalCollected: treasury?.totalCollected ?? "0",
        totalBurned: treasury?.totalBurned ?? "0",
      };
    }),

  marketStats: adminProcedure
    .meta({ description: "Admin market analytics" })
    .query(async () => {
      const tokens = await Q.crypto.token.where({}).all();
      const activeTokens = tokens.filter((t) => !t.isCrashed && !t.delistedAt);
      const crashedTokens = tokens.filter((t) => t.isCrashed);

      // 24h window is computed in-memory from the full transaction set to avoid
      // a parameterised date query; acceptable given expected transaction volume.
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const allTxs = await Q.crypto.transaction.where({}).all();
      const dailyTxs = allTxs.filter((tx) => tx.createdAt >= dayAgo);
      const dailyVolume = dailyTxs.reduce(
        (sum, tx) => sum + Math.abs(Number(tx.totalCost)),
        0,
      );
      const uniqueTraders = new Set(
        dailyTxs.map((tx) => tx.playerMinecraftUuid),
      ).size;

      const totalMarketCap = activeTokens.reduce((sum, t) => {
        return (
          sum + Number(t.price) * Number(t.totalSupply - t.availableSupply)
        );
      }, 0);

      const treasury = await Q.crypto.treasury.where({}).first();

      return {
        totalTokens: tokens.length,
        activeTokens: activeTokens.length,
        crashedTokens: crashedTokens.length,
        totalMarketCap: totalMarketCap.toFixed(2),
        dailyVolume: dailyVolume.toFixed(2),
        dailyTrades: dailyTxs.length,
        totalTrades: allTxs.length,
        uniqueTraders24h: uniqueTraders,
        feesCollected: treasury?.totalCollected ?? "0",
        feesBurned: treasury?.totalBurned ?? "0",
      };
    }),
};
