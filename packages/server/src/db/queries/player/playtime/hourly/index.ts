import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeHourlyBaseQueries } from "@/generated/db/player_playtime_hourly.queries";
import { creditBucketSql, splitPeriod } from "../split";

type ServerHeatMapRow = {
  hour_start: Date;
  unique_players: number;
  total_seconds: number;
};

export type ServerHeatMap = {
  hourStart: Date;
  uniquePlayers: number;
  totalSeconds: number;
};

/**
 * Custom queries for player_playtime_hourly table
 *
 * - Session aggregation: splits sessions across hour boundaries via upsert
 * - Server heatmap: per-hour activity metrics, bucketed by the viewer
 */
export class PlayerPlaytimeHourlyQueries extends PlayerPlaytimeHourlyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Credits `seconds` of playtime observed over [periodStart, periodEnd],
   * distributed across the hour buckets the window spans in proportion to
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
    const query = creditBucketSql(this.table, "play_hour");
    for (const { bucket, seconds: share } of splitPeriod(
      periodStart,
      periodEnd,
      seconds,
      "hour",
    )) {
      await this.runQuery("credit hourly playtime", query, [
        playerMinecraftUuid,
        serverId,
        bucket,
        share,
      ]);
    }
  }

  /**
   * Retrieves server activity heatmap data for visualization
   *
   * Returns unique players and total playtime for each hour as an instant,
   * so the caller buckets them into weekday x hour in its own time zone
   * regardless of the database session zone
   *
   * @param serverId - The ID of the server to analyze
   * @param days - Number of days to look back (default: 30)
   * @returns Array of heatmap data points with day, hour, and activity metrics
   */
  async getServerHeatmap(
    serverId: number,
    days: number = 30,
  ): Promise<ServerHeatMap[]> {
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new Error("Days must be an integer between 1 and 365");
    }

    const query = `
      SELECT
        play_hour as hour_start,
        COUNT(DISTINCT player_minecraft_uuid)::int as unique_players,
        SUM(seconds_played)::float8 as total_seconds
      FROM ${this.table}
      WHERE server_id = $1
        AND play_hour >= NOW() - INTERVAL '1 day' * $2
      GROUP BY play_hour
      ORDER BY play_hour`;

    const result = await this.runQuery<ServerHeatMapRow>(
      "get server heatmap",
      query,
      [serverId, days],
    );

    return this.mapRowsToEntities(result.rows);
  }
}
