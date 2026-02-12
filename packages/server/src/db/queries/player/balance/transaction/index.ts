import type { Pool, PoolClient } from "pg";
import { PlayerBalanceTransactionBaseQueries } from "@/generated/db/player_balance_transaction.queries";

/**
 * Custom queries for player_balance_transaction table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerBalanceTransactionQueries extends PlayerBalanceTransactionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get the total amount earned (sum of positive transactions) for a player.
   * Returns 0 if no positive transactions exist.
   */
  async getTotalEarned(playerUuid: string): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(amount), 0) AS total_earned
      FROM ${this.table}
      WHERE player_minecraft_uuid = $1 AND amount > 0`;

    try {
      const result = await this.db.query<{ total_earned: bigint }>(
        query,
        [playerUuid],
      );
      return Number(result.rows[0].total_earned);
    } catch (error) {
      logger.error("Failed to get total earned:", error);
      throw error;
    }
  }
}
