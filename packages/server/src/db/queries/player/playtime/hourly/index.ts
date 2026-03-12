import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeHourlyBaseQueries } from "@/generated/db/player_playtime_hourly.queries";

type PlayerHourlyPatternRow = {
  hour_of_day: string;
  total_seconds: string;
};

export type PlayerHourlyPattern = {
  hourOfDay: number;
  totalSeconds: number;
};

type ServerHeatMapRow = {
  day: Date;
  hour: string;
  unique_players: string;
  total_seconds: string;
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
   * Upserts hourly playtime records for a session, splitting across hour boundaries
   *
   * Iterates hour-by-hour from sessionStart to sessionEnd, computing per-hour seconds
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
    let currentHour = new Date(sessionStart);
    currentHour.setMinutes(0, 0, 0);

    while (currentHour < sessionEnd) {
      const nextHour = new Date(currentHour.getTime() + 60 * 60 * 1000);

      const periodStart =
        currentHour <= sessionStart ? sessionStart : currentHour;
      const periodEnd = nextHour <= sessionEnd ? nextHour : sessionEnd;
      const seconds = Math.floor(
        (periodEnd.getTime() - periodStart.getTime()) / 1000,
      );

      if (seconds > 0) {
        await this.db.query(
          `INSERT INTO ${this.table} (player_minecraft_uuid, server_id, play_hour, seconds_played)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (player_minecraft_uuid, server_id, play_hour)
           DO UPDATE SET seconds_played = ${this.table}.seconds_played + EXCLUDED.seconds_played`,
          [playerMinecraftUuid, serverId, currentHour, seconds],
        );
      }

      currentHour = nextHour;
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
        EXTRACT(HOUR FROM play_hour) as hour_of_day,
        SUM(seconds_played) as total_seconds
      FROM ${this.table}
      WHERE player_minecraft_uuid = $1
        AND server_id = $2
      GROUP BY EXTRACT(HOUR FROM play_hour)
      ORDER BY hour_of_day`;

    try {
      const result = await this.db.query(query, [
        playerMinecraftUuid,
        serverId,
      ]);

      return this.mapRowsToEntities<
        PlayerHourlyPatternRow,
        PlayerHourlyPattern
      >(result.rows);
    } catch (error) {
      logger.error("Failed to get player hourly pattern:", error);
      throw error;
    }
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
        EXTRACT(HOUR FROM play_hour) as hour,
        COUNT(DISTINCT player_minecraft_uuid) as unique_players,
        SUM(seconds_played) as total_seconds
      FROM ${this.table}
      WHERE server_id = $1
        AND play_hour >= NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE_TRUNC('day', play_hour), EXTRACT(HOUR FROM play_hour)
      ORDER BY day, hour`;

    try {
      const result = await this.db.query(query, [serverId, days]);

      return this.mapRowsToEntities<ServerHeatMapRow, ServerHeatMap>(
        result.rows,
      );
    } catch (error) {
      logger.error("Failed to get server heatmap:", error);
      throw error;
    }
  }
}
