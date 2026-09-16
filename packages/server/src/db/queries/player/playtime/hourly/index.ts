import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeHourlyBaseQueries } from "@/generated/db/player_playtime_hourly.queries";
import { splitPeriod } from "../split";

type PlayerHourlyPatternRow = {
  hour_of_day: number;
  total_seconds: number;
};

export type PlayerHourlyPattern = {
  hourOfDay: number;
  totalSeconds: number;
};

type ServerHeatMapRow = {
  day: Date;
  hour: number;
  unique_players: number;
  total_seconds: number;
};

export type ServerHeatMap = {
  day: Date;
  hour: number;
  uniquePlayers: number;
  totalSeconds: number;
};

/**
 * Custom queries for player_playtime_hourly table
 *
 * - Session aggregation: splits sessions across hour boundaries via upsert
 * - Player activity patterns: hourly playtime distribution (0-23)
 * - Server heatmap: day x hour grid of activity metrics
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
    for (const { bucket, seconds: share } of splitPeriod(
      periodStart,
      periodEnd,
      seconds,
      "hour",
    )) {
      await this.db.query(
        `INSERT INTO ${this.table} (player_minecraft_uuid, server_id, play_hour, seconds_played)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (player_minecraft_uuid, server_id, play_hour)
         DO UPDATE SET seconds_played = ${this.table}.seconds_played + EXCLUDED.seconds_played`,
        [playerMinecraftUuid, serverId, bucket, share],
      );
    }
  }

  /**
   * Retrieves a player's activity pattern aggregated by hour of the day
   *
   * Analyzes when a player is most active by grouping their playtime
   * across all days into 24 hourly buckets (0-23). Useful for identifying
   * peak playing hours and activity patterns
   *
   * @param playerMinecraftUuid - The Minecraft UUID of the player
   * @param serverId - The ID of the server to analyze activity for
   * @returns Array of hourly activity records with total seconds played per hour
   */
  async getPlayerHourlyPattern(
    playerMinecraftUuid: string,
    serverId: number,
  ): Promise<PlayerHourlyPattern[]> {
    const query = `
      SELECT
        EXTRACT(HOUR FROM play_hour)::int as hour_of_day,
        SUM(seconds_played)::float8 as total_seconds
      FROM ${this.table}
      WHERE player_minecraft_uuid = $1
        AND server_id = $2
      GROUP BY EXTRACT(HOUR FROM play_hour)
      ORDER BY hour_of_day`;

    const result = await this.runQuery("get player hourly pattern", query, [
      playerMinecraftUuid,
      serverId,
    ]);

    return this.mapRowsToEntities<PlayerHourlyPatternRow, PlayerHourlyPattern>(
      result.rows,
    );
  }

  /**
   * Retrieves server activity heatmap data for visualization
   *
   * Generates a 2D grid of activity metrics showing unique players and
   * total playtime for each hour of each day. Perfect for creating
   * heatmap visualizations to identify peak activity times
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
        DATE_TRUNC('day', play_hour) as day,
        EXTRACT(HOUR FROM play_hour)::int as hour,
        COUNT(DISTINCT player_minecraft_uuid)::int as unique_players,
        SUM(seconds_played)::float8 as total_seconds
      FROM ${this.table}
      WHERE server_id = $1
        AND play_hour >= NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE_TRUNC('day', play_hour), EXTRACT(HOUR FROM play_hour)
      ORDER BY day, hour`;

    const result = await this.runQuery("get server heatmap", query, [
      serverId,
      days,
    ]);

    return this.mapRowsToEntities<ServerHeatMapRow, ServerHeatMap>(result.rows);
  }
}
