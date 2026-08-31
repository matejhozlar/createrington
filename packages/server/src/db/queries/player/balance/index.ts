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
 * - Aggregate statistics (total in circulation, distribution, median)
 * - Leaderboard (top N by balance, joined with player usernames)
 *
 * NOTE: All balance values are stored as bigint with 3-decimal precision (see BalanceUtils)
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
  async getTotalInCirculation(): Promise<{
    totalBalance: number;
    playerCount: number;
  }> {
    const query = `
      SELECT
        COALESCE(SUM(balance), 0) AS total_balance,
        COUNT(*)::integer AS player_count
      FROM ${this.table}`;

    const result = await this.runQuery<{
      total_balance: bigint;
      player_count: number;
    }>("get total in circulation", query);
    const row = result.rows[0];
    return {
      totalBalance: BalanceUtils.fromStorage(row.total_balance),
      playerCount: row.player_count,
    };
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

    const result = await this.runQuery<{ range: string; count: number }>(
      "get balance distribution",
      query,
    );
    return result.rows;
  }

  /**
   * Get aggregate balance statistics (total, average, median) in a single query
   *
   * Uses SQL aggregation instead of loading all rows into memory.
   * Balances are returned in storage format (bigint).
   */
  async getAggregateStats(): Promise<{
    total: bigint;
    average: bigint;
    median: bigint;
  }> {
    const query = `
      SELECT
        COALESCE(SUM(balance), 0) AS total,
        COALESCE(AVG(balance), 0)::bigint AS average,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY balance), 0)::bigint AS median
      FROM ${this.table}`;

    const result = await this.runQuery<{
      total: bigint;
      average: bigint;
      median: bigint;
    }>("get balance aggregate stats", query);
    const row = result.rows[0];
    return {
      total: BigInt(row.total),
      average: BigInt(row.average),
      median: BigInt(row.median),
    };
  }

  /**
   * Reads a player's balance under a row lock (SELECT ... FOR UPDATE). Must be
   * called on a transaction-bound instance; the lock is held until the
   * surrounding transaction ends, serializing every concurrent mutation of
   * the same row.
   *
   * @returns Balance in storage format, or null when the player has no balance row
   */
  async getForUpdate(minecraftUuid: string): Promise<bigint | null> {
    const query = `
      SELECT balance
      FROM ${this.table}
      WHERE minecraft_uuid = $1
      FOR UPDATE`;

    const result = await this.runQuery<{ balance: bigint }>(
      "get balance for update",
      query,
      [minecraftUuid],
    );

    return result.rows[0]?.balance ?? null;
  }

  /**
   * Gets top N players by balance, joined with player table for usernames
   *
   * @param limit - Maximum entries to return (default: 10)
   * @returns Leaderboard entries with player name and user-facing decimal balance
   */
  async getTop(limit: number = 10): Promise<BalanceLeaderboardEntry[]> {
    const query = `
      SELECT p.minecraft_username AS name, pb.balance
      FROM ${this.table} pb
      JOIN player p ON p.minecraft_uuid = pb.minecraft_uuid
      ORDER BY pb.balance DESC
      LIMIT $1`;

    const result = await this.runQuery<{ name: string; balance: bigint }>(
      "get top balances",
      query,
      [limit],
    );

    return result.rows.map((row) => ({
      name: row.name,
      balance: BalanceUtils.fromStorage(row.balance),
    }));
  }

  /**
   * Gets every player's non-zero balance keyed by Minecraft UUID.
   *
   * @returns Balance records as user-facing decimals
   */
  async getAllBalances(): Promise<
    Array<{ minecraftUuid: string; balance: number }>
  > {
    const query = `SELECT minecraft_uuid, balance FROM ${this.table} WHERE balance > 0`;

    const result = await this.runQuery<{
      minecraft_uuid: string;
      balance: bigint;
    }>("get all balances", query);

    return result.rows.map((row) => ({
      minecraftUuid: row.minecraft_uuid,
      balance: BalanceUtils.fromStorage(row.balance),
    }));
  }
}
