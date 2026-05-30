import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeDailyBaseQueries } from "@/generated/db/player_playtime_daily.queries";

type ServerActivityRow = {
  play_date: Date;
  unique_players: string;
  total_seconds: string;
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
   * Upserts daily playtime records for a session, splitting across day boundaries
   *
   * Iterates day-by-day from sessionStart to sessionEnd, computing per-day seconds
   * and upserting via ON CONFLICT to increment existing records.
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server ID the session occurred on
   * @param sessionStart - Session start timestamp
   * @param sessionEnd - Session end timestamp
   */
  async aggregateSession(
    playerMinecraftUuid: string,
    serverId: number,
    sessionStart: Date,
    sessionEnd: Date,
  ): Promise<void> {
    const startDay = new Date(sessionStart);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(sessionEnd);
    endDay.setHours(0, 0, 0, 0);

    let currentDay = new Date(startDay);

    while (currentDay <= endDay) {
      const nextDay = new Date(currentDay);
      nextDay.setDate(nextDay.getDate() + 1);

      const periodStart =
        currentDay <= sessionStart ? sessionStart : currentDay;
      const periodEnd = nextDay <= sessionEnd ? nextDay : sessionEnd;
      const seconds = Math.floor(
        (periodEnd.getTime() - periodStart.getTime()) / 1000,
      );

      if (seconds > 0) {
        await this.db.query(
          `INSERT INTO ${this.table} (player_minecraft_uuid, server_id, play_date, seconds_played)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (player_minecraft_uuid, server_id, play_date)
           DO UPDATE SET seconds_played = ${this.table}.seconds_played + EXCLUDED.seconds_played`,
          [playerMinecraftUuid, serverId, currentDay, seconds],
        );
      }

      currentDay = nextDay;
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
      COUNT(DISTINCT player_minecraft_uuid) as unique_players,
      SUM(seconds_played) as total_seconds
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
