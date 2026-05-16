import type { Pool, PoolClient } from "pg";
import { PlayerSessionBaseQueries } from "@/generated/db/player_session.queries";

interface ServerSessionRow {
  id: number;
  player_minecraft_uuid: string;
  server_id: number;
  session_start: Date;
  session_end: Date | null;
  seconds_played: string | null;
  minecraft_username: string;
}

export type ServerSessionEntry = {
  id: number;
  playerMinecraftUuid: string;
  serverId: number;
  sessionStart: Date;
  sessionEnd: Date | null;
  secondsPlayed: number | null;
  minecraftUsername: string;
};

/**
 * Custom queries for player_session table
 *
 * - Active/unique player count analytics per time period
 * - Average session length and peak concurrent player detection
 * - New vs returning player classification
 * - Server-scoped paginated session listing with player usernames
 */
export class PlayerSessionQueries extends PlayerSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get unique active player counts grouped by time period
   *
   * Counts distinct players who started a session within each period.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with unique player counts
   */
  async getActivePlayerCounts(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<Array<{ period: string; uniquePlayers: number }>> {
    const query = `
      SELECT
        DATE_TRUNC($3, session_start)::text AS period,
        COUNT(DISTINCT player_minecraft_uuid)::integer AS unique_players
      FROM ${this.table}
      WHERE session_start >= $1 AND session_start < $2
      GROUP BY 1
      ORDER BY 1`;

    try {
      const result = await this.db.query<{
        period: string;
        unique_players: number;
      }>(query, [start, end, granularity]);
      return result.rows.map((row) => ({
        period: row.period,
        uniquePlayers: row.unique_players,
      }));
    } catch (error) {
      logger.error("Failed to get active player counts:", error);
      throw error;
    }
  }

  /**
   * Get average session length in seconds
   *
   * Only considers sessions where seconds_played is recorded.
   * Date filters are optional; omit both for all-time average.
   *
   * @param start - Optional start of date range (inclusive)
   * @param end - Optional end of date range (exclusive)
   * @returns Average session duration in seconds, or 0 if no sessions
   */
  async getAverageSessionLength(start?: Date, end?: Date): Promise<number> {
    const conditions = ["seconds_played IS NOT NULL"];
    const params: unknown[] = [];

    if (start) {
      params.push(start);
      conditions.push(`session_start >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      conditions.push(`session_start < $${params.length}`);
    }

    const query = `
      SELECT COALESCE(AVG(seconds_played), 0)::float AS avg_seconds
      FROM ${this.table}
      WHERE ${conditions.join(" AND ")}`;

    try {
      const result = await this.db.query<{ avg_seconds: number }>(
        query,
        params,
      );
      return result.rows[0].avg_seconds;
    } catch (error) {
      logger.error("Failed to get average session length:", error);
      throw error;
    }
  }

  /**
   * Get peak concurrent player count within a time range
   *
   * Generates hourly time slots via generate_series, then counts
   * overlapping sessions at each slot to find the peak.
   *
   * @param start - Start of the date range
   * @param end - End of the date range
   * @returns Peak concurrent count and the timestamp it occurred at
   */
  async getPeakConcurrent(
    start: Date,
    end: Date,
  ): Promise<{ peakCount: number; peakTime: string }> {
    const query = `
      WITH hours AS (
        SELECT generate_series($1::timestamptz, $2::timestamptz, '1 hour') AS hour
      )
      SELECT
        h.hour::text AS peak_time,
        COUNT(s.id)::integer AS peak_count
      FROM hours h
      LEFT JOIN ${this.table} s
        ON s.session_start <= h.hour
        AND (s.session_end IS NULL OR s.session_end > h.hour)
      GROUP BY h.hour
      ORDER BY peak_count DESC, h.hour
      LIMIT 1`;

    try {
      const result = await this.db.query<{
        peak_time: string;
        peak_count: number;
      }>(query, [start, end]);
      const row = result.rows[0];
      return {
        peakCount: row?.peak_count ?? 0,
        peakTime: row?.peak_time ?? start.toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get peak concurrent:", error);
      throw error;
    }
  }

  /**
   * Get new vs returning players per day within a time range
   *
   * Uses a CTE to determine each player's first-ever session, then
   * classifies daily sessions as "new" (first session that day) or
   * "returning" (had sessions before that day).
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @returns Array of dates with new and returning player counts
   */
  async getNewVsReturning(
    start: Date,
    end: Date,
  ): Promise<
    Array<{ date: string; newPlayers: number; returningPlayers: number }>
  > {
    const query = `
      WITH first_sessions AS (
        SELECT player_minecraft_uuid, MIN(session_start) AS first_session
        FROM ${this.table}
        GROUP BY player_minecraft_uuid
      ),
      daily AS (
        SELECT
          DATE_TRUNC('day', s.session_start)::text AS date,
          COUNT(DISTINCT s.player_minecraft_uuid) FILTER (
            WHERE DATE_TRUNC('day', fs.first_session) = DATE_TRUNC('day', s.session_start)
          )::integer AS new_players,
          COUNT(DISTINCT s.player_minecraft_uuid) FILTER (
            WHERE DATE_TRUNC('day', fs.first_session) < DATE_TRUNC('day', s.session_start)
          )::integer AS returning_players
        FROM ${this.table} s
        JOIN first_sessions fs ON fs.player_minecraft_uuid = s.player_minecraft_uuid
        WHERE s.session_start >= $1 AND s.session_start < $2
        GROUP BY 1
      )
      SELECT * FROM daily ORDER BY date`;

    try {
      const result = await this.db.query<{
        date: string;
        new_players: number;
        returning_players: number;
      }>(query, [start, end]);

      return result.rows.map((row) => ({
        date: row.date,
        newPlayers: row.new_players,
        returningPlayers: row.returning_players,
      }));
    } catch (error) {
      logger.error("Failed to get new vs returning:", error);
      throw error;
    }
  }

  /**
   * Get paginated sessions for a specific server with player usernames
   *
   * Joins with the player table to include minecraft_username.
   * Returns both the page of sessions and the total count for pagination.
   *
   * @param serverId - Server ID to query
   * @param limit - Page size
   * @param offset - Number of rows to skip
   * @returns Sessions for the page and total row count
   */
  async getServerSessions(
    serverId: number,
    limit: number,
    offset: number,
  ): Promise<{ sessions: ServerSessionEntry[]; total: number }> {
    const dataQuery = `
      SELECT s.id, s.player_minecraft_uuid, s.server_id, s.session_start, s.session_end, s.seconds_played,
             p.minecraft_username
      FROM ${this.table} s
      JOIN player p ON p.minecraft_uuid = s.player_minecraft_uuid
      WHERE s.server_id = $1
      ORDER BY s.session_start DESC
      LIMIT $2 OFFSET $3`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.table}
      WHERE server_id = $1`;

    try {
      const [dataResult, countResult] = await Promise.all([
        this.db.query(dataQuery, [serverId, limit, offset]),
        this.db.query(countQuery, [serverId]),
      ]);

      const sessions: ServerSessionEntry[] = dataResult.rows.map(
        (row: ServerSessionRow) => ({
          id: row.id,
          playerMinecraftUuid: row.player_minecraft_uuid,
          serverId: row.server_id,
          sessionStart: row.session_start,
          sessionEnd: row.session_end,
          secondsPlayed: row.seconds_played ? Number(row.seconds_played) : null,
          minecraftUsername: row.minecraft_username,
        }),
      );

      return {
        sessions,
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error("Failed to get server sessions:", error);
      throw error;
    }
  }
}
