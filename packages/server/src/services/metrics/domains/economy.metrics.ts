import { Q } from "@/db";

/**
 * Economy Metrics Domain
 *
 * Surfaces monetary health indicators for the admin dashboard:
 * - Total balance in circulation with per-player average
 * - Balance distribution across predefined ranges
 * - Transaction volume (credits/debits) over time
 * - Leaderboard of top balances
 */
export class EconomyMetrics {
  /**
   * Get economy overview: total balance, player count, and average balance
   *
   * @returns Aggregate economy snapshot
   */
  async getOverview() {
    const data = await Q.player.balance.getTotalInCirculation();
    return {
      totalBalance: data.totalBalance,
      playerCount: data.playerCount,
      averageBalance:
        data.playerCount > 0 ? data.totalBalance / data.playerCount : 0,
    };
  }

  /**
   * Get balance distribution across predefined ranges
   *
   * @returns Array of range labels with player counts
   */
  async getDistribution() {
    return await Q.player.balance.getDistribution();
  }

  /**
   * Get transaction volume aggregated by time period
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Array of periods with transaction count, credits, and debits
   */
  async getTransactionVolume(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    return await Q.player.balance.transaction.getVolumeByPeriod(
      start,
      end,
      granularity,
    );
  }

  /**
   * Get top players by balance
   *
   * @param limit - Maximum number of entries to return
   * @returns Leaderboard entries with player name and balance
   */
  async getTopBalances(limit: number = 10) {
    return await Q.player.balance.getTop(limit);
  }
}
