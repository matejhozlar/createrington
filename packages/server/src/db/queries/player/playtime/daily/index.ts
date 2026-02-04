import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeDailyBaseQueries } from "@/generated/db/player_playtime_daily.queries";

export type ServerActivity = {
  playDate: Date;
  uniquePlayers: number;
  totalSeconds: number;
};

/**
 * Custom queries for player_playtime_daily table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerPlaytimeDailyQueries extends PlayerPlaytimeDailyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here

  /**
   * Retrieves aggregated daily activity metrics for a specific server
   *
   * Returns daily statistics including unique player count and total playtime
   * for each day within the specified date range
   *
   * @param serverId - The ID of the server to query activity for
   * @param startDate - Start date of the range (inclusive)
   * @param endDate - End date of the range (inclusive)
   * @returns Array of daily activity records, ordered chronologically
   */
  async getServerActivity(
    serverId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<ServerActivity[]> {
    const query = `
    SELECT 
      play_date,
      COUNT(DISTINCT player_minecraft_uuid) as unique_players,
      SUM(seconds_played) as total_seconds
    FROM ${this.table}
    WHERE server_id = $1
      AND play_date >= $2
      AND play_date <= $3
    GROUP BY play_date
    ORDER BY play_date ASC`;

    try {
      const result = await this.db.query(query, [serverId, startDate, endDate]);

      return this.mapRowsToEntities<any, ServerActivity>(result.rows);
    } catch (error) {
      logger.error("Failed to get server daily activity:", error);
      throw error;
    }
  }
}
