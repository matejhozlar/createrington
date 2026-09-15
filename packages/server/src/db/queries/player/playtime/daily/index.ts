import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeDailyBaseQueries } from "@/generated/db/player_playtime_daily.queries";
import { splitPeriod } from "../split";

type ServerActivityRow = {
  play_date: Date;
  unique_players: number;
  total_seconds: number;
};

export type ServerActivity = {
  playDate: Date;
  uniquePlayers: number;
  totalSeconds: number;
};

/**
 * Custom queries for player_playtime_daily table
 *
 * - Session aggregation: splits sessions across day boundaries via upsert
 * - Server activity analytics: daily unique players and total playtime
 */
export class PlayerPlaytimeDailyQueries extends PlayerPlaytimeDailyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Credits `seconds` of playtime observed over [periodStart, periodEnd],
   * distributed across the day buckets the window spans in proportion to
   * the wall-clock time each covers. Upserts via ON CONFLICT so repeated
   * credits accumulate.
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID the playtime occurred on
   * @param periodStart - Start of the observation window
   * @param periodEnd - End of the observation window
   * @param seconds - Seconds to credit (may be less than the window's wall-clock length)
   */
  async creditPeriod(
    playerMinecraftUuid: string,
    serverId: number,
    periodStart: Date,
    periodEnd: Date,
    seconds: number,
  ): Promise<void> {
    for (const { bucket, seconds: share } of splitPeriod(
      periodStart,
      periodEnd,
      seconds,
      "day",
    )) {
      await this.db.query(
        `INSERT INTO ${this.table} (player_minecraft_uuid, server_id, play_date, seconds_played)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (player_minecraft_uuid, server_id, play_date)
         DO UPDATE SET seconds_played = ${this.table}.seconds_played + EXCLUDED.seconds_played`,
        [playerMinecraftUuid, serverId, bucket, share],
      );
    }
  }

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
      COUNT(DISTINCT player_minecraft_uuid)::int as unique_players,
      SUM(seconds_played)::float8 as total_seconds
    FROM ${this.table}
    WHERE server_id = $1
      AND play_date >= $2
      AND play_date <= $3
    GROUP BY play_date
    ORDER BY play_date ASC`;

    const result = await this.runQuery("get server daily activity", query, [
      serverId,
      startDate,
      endDate,
    ]);

    return this.mapRowsToEntities<ServerActivityRow, ServerActivity>(
      result.rows,
    );
  }
}
