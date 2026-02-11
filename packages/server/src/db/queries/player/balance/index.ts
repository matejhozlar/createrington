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
