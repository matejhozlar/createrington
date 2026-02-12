import type { Pool, PoolClient } from "pg";
import { PlayerBalanceBaseQueries } from "@/generated/db/player_balance.queries";
import { BalanceUtils } from "@/db/repositories/balance/utils";

export type BalanceLeaderboardEntry = {
  name: string;
  balance: number;
};

/**
 * Custom queries for player_balance table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerBalanceQueries extends PlayerBalanceBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get total balance in circulation across all players
   *
   * Sums all balances and counts players with a balance record.
   * Balances are converted from storage format via BalanceUtils.
   *
   * @returns Total balance (user-facing decimal) and number of players
   */
  async getTotalInCirculation(): Promise<{ totalBalance: number; playerCount: number }> {
    const query = `
      SELECT
        COALESCE(SUM(balance), 0) AS total_balance,
        COUNT(*)::integer AS player_count
      FROM ${this.table}`;

    try {
      const result = await this.db.query<{ total_balance: bigint; player_count: number }>(query);
      const row = result.rows[0];
      return {
        totalBalance: BalanceUtils.fromStorage(row.total_balance),
        playerCount: row.player_count,
      };
    } catch (error) {
      logger.error("Failed to get total in circulation:", error);
      throw error;
    }
  }

  /**
   * Get balance distribution across predefined ranges
   *
   * Buckets players into ranges: 0-100, 100-500, 500-1k, 1k-5k, 5k+.
   * Thresholds use storage format (multiplied by 1000).
   *
   * @returns Array of range labels with player counts, ordered by balance ascending
   */
  async getDistribution(): Promise<Array<{ range: string; count: number }>> {
    const query = `
      SELECT
        CASE
          WHEN balance < ${100 * 1000} THEN '0-100'
          WHEN balance < ${500 * 1000} THEN '100-500'
          WHEN balance < ${1000 * 1000} THEN '500-1k'
          WHEN balance < ${5000 * 1000} THEN '1k-5k'
          ELSE '5k+'
        END AS range,
        COUNT(*)::integer AS count
      FROM ${this.table}
      GROUP BY 1
      ORDER BY MIN(balance)`;

    try {
      const result = await this.db.query<{ range: string; count: number }>(query);
      return result.rows;
    } catch (error) {
      logger.error("Failed to get balance distribution:", error);
      throw error;
    }
  }

  /**
   * Get aggregate balance statistics (total, average, median) in a single query
   *
   * Uses SQL aggregation instead of loading all rows into memory.
   * Balances are returned in storage format (bigint).
   */
  async getAggregateStats(): Promise<{ total: bigint; average: bigint; median: bigint }> {
    const query = `
      SELECT
        COALESCE(SUM(balance), 0) AS total,
        COALESCE(AVG(balance), 0)::bigint AS average,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY balance), 0)::bigint AS median
      FROM ${this.table}`;

    try {
      const result = await this.db.query<{ total: bigint; average: bigint; median: bigint }>(query);
      const row = result.rows[0];
      return {
        total: BigInt(row.total),
        average: BigInt(row.average),
        median: BigInt(row.median),
      };
    } catch (error) {
      logger.error("Failed to get balance aggregate stats:", error);
      throw error;
    }
  }

  /**
   * Gets top N players by balance, joined with player table for usernames
   */
  async getTop(limit: number = 10): Promise<BalanceLeaderboardEntry[]> {
    const query = `
      SELECT p.minecraft_username AS name, pb.balance
      FROM ${this.table} pb
      JOIN player p ON p.minecraft_uuid = pb.minecraft_uuid
      ORDER BY pb.balance DESC
      LIMIT $1`;

    try {
      const result = await this.db.query<{ name: string; balance: bigint }>(
        query,
        [limit],
      );

      return result.rows.map((row) => ({
        name: row.name,
        balance: BalanceUtils.fromStorage(row.balance),
      }));
    } catch (error) {
      logger.error("Failed to get top balances:", error);
      throw error;
    }
  }
}
