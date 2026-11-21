import type { Pool, PoolClient } from "pg";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { PlayerSessionBaseQueries } from "@/generated/db/player_session.queries";
import type { Granularity } from "@/db/utils";

export interface ServerSessionRow {
  id: number;
  player_minecraft_uuid: string;
  server_id: number;
  session_start: Date;
  session_end: Date | null;
  seconds_played: number | null;
  minecraft_username: string;
}

export type ServerSessionEntry = CamelCaseKeys<ServerSessionRow>;

export interface OpenSessionRow {
  id: number;
  player_minecraft_uuid: string;
  server_id: number;
  session_start: Date;
  last_seen_at: Date | null;
  last_play_ticks: number | null;
  active_seconds: number;
  minecraft_username: string;
}

export type OpenSessionEntry = CamelCaseKeys<OpenSessionRow>;

export interface SessionObservation {
  lastSeenAt: Date;
  lastPlayTicks?: number;
  creditedSeconds: number;
  sessionEnd?: Date;
}

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
   * Open sessions on a server joined with the player's current username,
   * in the shape the in-memory tracker restores from after a restart.
   *
   * @param serverId - Server ID to query
   */
  async findOpenWithUsername(serverId: number): Promise<OpenSessionEntry[]> {
    const query = `
      SELECT s.id, s.player_minecraft_uuid, s.server_id, s.session_start,
             s.last_seen_at, s.last_play_ticks, s.active_seconds::float8 AS active_seconds,
             p.minecraft_username
      FROM ${this.table} s
      JOIN player p ON p.minecraft_uuid = s.player_minecraft_uuid
      WHERE s.server_id = $1 AND s.session_end IS NULL
      ORDER BY s.session_start`;

    const result = await this.runQuery<OpenSessionRow>(
      "find open sessions",
      query,
      [serverId],
    );

    return this.mapRowsToEntities(result.rows);
  }

  /**
   * Records a presence observation on a session: advances last_seen_at,
   * stores the newest play_time tick reading when one was reported, adds the
   * credited seconds, and optionally closes the session.
   *
   * @param id - Session row ID
   * @param observation - What was observed and how much to credit
   */
  async recordObservation(
    id: number,
    observation: SessionObservation,
  ): Promise<void> {
    await this.runQuery(
      "record session observation",
      `UPDATE ${this.table}
       SET last_seen_at = $2,
           last_play_ticks = COALESCE($3, last_play_ticks),
           active_seconds = active_seconds + $4,
           session_end = COALESCE($5, session_end)
       WHERE id = $1`,
      [
        id,
        observation.lastSeenAt,
        observation.lastPlayTicks ?? null,
        observation.creditedSeconds,
        observation.sessionEnd ?? null,
      ],
    );
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
    granularity: Granularity = "day",
  ): Promise<Array<{ period: string; uniquePlayers: number }>> {
    return this.aggregateByPeriod<{ unique_players: number }>(
      "get active player counts",
      "sessionStart",
      { unique_players: "COUNT(DISTINCT player_minecraft_uuid)::int" },
      start,
      end,
      granularity,
    );
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
      SELECT COALESCE(AVG(seconds_played), 0)::float8 AS avg_seconds
      FROM ${this.table}
      WHERE ${conditions.join(" AND ")}`;

    const result = await this.runQuery<{ avg_seconds: number }>(
      "get average session length",
      query,
      params,
    );
    return result.rows[0].avg_seconds;
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
    const [dataResult, countResult] = await Promise.all([
      this.runQuery<ServerSessionRow>(
        "get server sessions",
        `SELECT s.id, s.player_minecraft_uuid, s.server_id, s.session_start, s.session_end,
                s.seconds_played::float8 AS seconds_played, p.minecraft_username
         FROM ${this.table} s
         JOIN player p ON p.minecraft_uuid = s.player_minecraft_uuid
         WHERE s.server_id = $1
         ORDER BY s.session_start DESC
         LIMIT $2 OFFSET $3`,
        [serverId, limit, offset],
      ),
      this.runQuery<{ total: number }>(
        "count server sessions",
        `SELECT COUNT(*)::int AS total FROM ${this.table} WHERE server_id = $1`,
        [serverId],
      ),
    ]);

    return {
      sessions: this.mapRowsToEntities(dataResult.rows),
      total: countResult.rows[0].total,
    };
  }
}
