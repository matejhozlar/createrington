import type { Pool, PoolClient } from "pg";
import { PlayerPlaytimeSummaryBaseQueries } from "@/generated/db/player_playtime_summary.queries";

export type GlobalLeaderboardEntry = {
  discordId: string;
  minecraftUsername: string;
  playerMinecraftUuid: string;
  totalSeconds: number;
};

export type LeaderboardEntry = {
  id: number;
  playerMinecraftUuid: string;
  serverId: number;
  totalSeconds: number;
  totalSessions: number;
  avgSessionSeconds: number;
  firstSeen: Date;
  lastSeen: Date;
  minecraftUsername: string;
};

export type ServerStats = {
  totalPlayers: number;
  totalSeconds: number;
  avgSessionSeconds: number;
};

export type PlayerServerPlaytime = {
  serverId: number;
  serverName: string;
  totalSeconds: number;
  totalSessions: number;
  avgSessionSeconds: number;
  firstSeen: Date;
  lastSeen: Date;
};

export type PlayerPlaytimeBreakdown = {
  playerMinecraftUuid: string;
  servers: PlayerServerPlaytime[];
  totals: {
    totalSeconds: number;
    totalSessions: number;
    serverCount: number;
    firstSeen: Date;
    lastSeen: Date;
  };
};

export interface ServerHoursBreakdown {
  byServer: Array<{
    serverId: number;
    serverName: string;
    hours: number;
  }>;
  total: number;
}

/**
 * Custom queries for player_playtime_summary table
 *
 * - Session aggregation: increments total seconds/sessions and updates first/last seen
 * - Leaderboard: top players by total playtime with usernames
 * - Server-wide statistics (total players, playtime, avg session)
 * - Per-player breakdown across all servers
 * - Total hours (single-server or global) with optional server breakdown
 */
export class PlayerPlaytimeSummaryQueries extends PlayerPlaytimeSummaryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Upserts a playtime summary record for a completed session
   *
   * Increments total seconds/sessions and adjusts first_seen/last_seen
   * boundaries via LEAST/GREATEST. Uses ON CONFLICT for idempotent upsert.
   *
   * @param playerMinecraftUuid - Player's Minecraft UUID
   * @param serverId - Server the session occurred on
   * @param secondsPlayed - Duration of the completed session
   * @param sessionStart - Session start timestamp (used for first_seen)
   * @param sessionEnd - Session end timestamp (used for last_seen)
   */
  async aggregateSession(
    playerMinecraftUuid: string,
    serverId: number,
    secondsPlayed: number,
    sessionStart: Date,
    sessionEnd: Date,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.table} (player_minecraft_uuid, server_id, total_seconds, total_sessions, first_seen, last_seen)
       VALUES ($1, $2, $3, 1, $4, $5)
       ON CONFLICT (player_minecraft_uuid, server_id)
       DO UPDATE SET
         total_seconds = ${this.table}.total_seconds + EXCLUDED.total_seconds,
         total_sessions = ${this.table}.total_sessions + 1,
         first_seen = LEAST(${this.table}.first_seen, EXCLUDED.first_seen),
         last_seen = GREATEST(${this.table}.last_seen, EXCLUDED.last_seen),
         updated_at = NOW()`,
      [playerMinecraftUuid, serverId, secondsPlayed, sessionStart, sessionEnd],
    );
  }

  /**
   * Retrieves server playtime leaderboard with player usernames
   *
   * Returns the top players by total playtime for a specific server,
   * including their current Minecraft username. Joins with the player
   * table to provide display names for the leaderboard
   *
   * @param serverId - The ID of the server to generate leaderboard for
   * @param limit - Maximum number of entries to return (default: 10)
   * @returns Array of leaderboard entries sorted by total playtime descending
   */
  async getLeaderboard(
    serverId: number,
    limit: number = 10,
  ): Promise<LeaderboardEntry[]> {
    const query = `
      SELECT 
        s.*,
        p.minecraft_username
      FROM ${this.table} s
      JOIN player p ON p.minecraft_uuid = s.player_minecraft_uuid
      WHERE s.server_id = $1
      ORDER BY s.total_seconds DESC
      LIMIT $2`;

    const result = await this.runQuery("get leaderboard", query, [
      serverId,
      limit,
    ]);

    return result.rows.map((row) => ({
      ...this.mapRowToEntity(row),
      minecraftUsername: row.minecraft_username,
    }));
  }

  /**
   * Retrieves aggregated statistics for a server
   *
   * Calculates server-wide metrics including total unique players,
   * cumulative playtime, total sessions, and average session duration
   * Useful for server analytics dashboards
   *
   * @param serverId - The ID of the server to analyze
   * @returns Object containing aggregated server statistics
   */
  async getServerStats(serverId: number): Promise<ServerStats> {
    const query = `
      SELECT 
        COUNT(*) as total_players,
        SUM(total_seconds) as total_seconds,
        SUM(total_sessions) as total_sessions,
        AVG(avg_session_seconds) as avg_session_seconds
      FROM ${this.table}
      WHERE server_id = $1`;

    const result = await this.runQuery("get server stats", query, [serverId]);

    return this.mapRowToEntity<ServerStats, ServerStats>(result.rows[0]);
  }

  /**
   * Retrieves detailed playtime breakdown for a player across all servers
   *
   * Returns per-server statistics along with aggregated totals.
   * Includes server names, individual playtime, sessions, and overall statistics
   *
   * @param playerMinecraftUuid - The Minecraft UUID of the player
   * @returns Complete playtime breakdown with per-server and total statistics
   */
  async getBreakdown(
    playerMinecraftUuid: string,
  ): Promise<PlayerPlaytimeBreakdown> {
    const query = `
      SELECT 
        s.player_minecraft_uuid,
        s.server_id,
        srv.name as server_name,
        s.total_seconds,
        s.total_sessions,
        s.avg_session_seconds,
        s.first_seen,
        s.last_seen
      FROM ${this.table} s
      JOIN server srv ON srv.id = s.server_id
      WHERE s.player_minecraft_uuid = $1
      ORDER BY s.total_seconds DESC`;

    const result = await this.runQuery("get playtime breakdown", query, [
      playerMinecraftUuid,
    ]);

    if (result.rows.length === 0) {
      throw new Error(
        `No playtime data found for player ${playerMinecraftUuid}`,
      );
    }

    const servers: PlayerServerPlaytime[] = result.rows.map((row) => ({
      serverId: row.server_id,
      serverName: row.server_name,
      totalSeconds: Number(row.total_seconds),
      totalSessions: row.total_sessions,
      avgSessionSeconds: Number(row.avg_session_seconds),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }));

    // Calculate totals
    const totals = {
      totalSeconds: servers.reduce((sum, s) => sum + s.totalSeconds, 0),
      totalSessions: servers.reduce((sum, s) => sum + s.totalSessions, 0),
      serverCount: servers.length,
      firstSeen: new Date(
        Math.min(...servers.map((s) => s.firstSeen.getTime())),
      ),
      lastSeen: new Date(Math.max(...servers.map((s) => s.lastSeen.getTime()))),
    };

    return {
      playerMinecraftUuid,
      servers,
      totals,
    };
  }

  /**
   * Get total hours played on a server or across all servers
   *
   * Optimized single-query aggregation that returns floored hours.
   * Uses SUM aggregation for efficiency.
   *
   * @param serverId - Optional server ID. If omitted, returns total across all servers
   * @returns Total hours played, floored to whole number
   *
   * @example
   * // Get hours for server 1
   * const hours = await Q.player.playtime.summary.getTotalHours(1);
   * // Result: 1234 (even if actual is 1234.99)
   *
   * @example
   * // Get hours across all servers
   * const hours = await Q.player.playtime.summary.getTotalHours();
   * // Result: 5678
   */
  async getTotalHours(serverId?: number): Promise<number> {
    const query = serverId
      ? `
        SELECT 
          FLOOR(SUM(total_seconds) / 3600) as total_hours
        FROM ${this.table}
        WHERE server_id = $1
      `
      : `
        SELECT 
          FLOOR(SUM(total_seconds) / 3600) as total_hours
        FROM ${this.table}
      `;

    const result = await this.runQuery<{ total_hours: string | null }>(
      "get total hours",
      query,
      serverId ? [serverId] : [],
    );

    // Handle null (no data) or convert string to number
    const totalHours = result.rows[0]?.total_hours;
    return totalHours ? parseInt(totalHours, 10) : 0;
  }

  /**
   * Get total hours played with breakdown by server
   *
   * Returns floored hours for each server plus global total. The total is
   * floored once from the summed seconds rather than summed from the
   * per-server floors, so it always equals getTotalHours().
   * Useful for dashboard displays.
   *
   * @returns Object with server breakdown and global total
   *
   * @example
   * const breakdown = await Q.player.playtime.summary.getTotalHoursBreakdown();
   * // Result: {
   * //   byServer: [
   * //     { serverId: 1, serverName: "Survival", hours: 1234 },
   * //     { serverId: 2, serverName: "Creative", hours: 987 }
   * //   ],
   * //   total: 2222
   * // }
   */
  async getTotalHoursBreakdown(): Promise<ServerHoursBreakdown> {
    const query = `
      SELECT
        s.server_id,
        srv.name as server_name,
        SUM(s.total_seconds) as total_seconds
      FROM ${this.table} s
      JOIN server srv ON srv.id = s.server_id
      GROUP BY s.server_id, srv.name
      ORDER BY total_seconds DESC
    `;

    const result = await this.runQuery<{
      server_id: number;
      server_name: string;
      total_seconds: string;
    }>("get total hours breakdown", query);

    const byServer = result.rows.map((row) => ({
      serverId: row.server_id,
      serverName: row.server_name,
      hours: Math.floor(Number(row.total_seconds) / 3600),
    }));

    const totalSeconds = result.rows.reduce(
      (sum, row) => sum + Number(row.total_seconds),
      0,
    );
    const total = Math.floor(totalSeconds / 3600);

    return { byServer, total };
  }

  /**
   * Retrieves the global playtime leaderboard aggregated across all servers
   *
   * Sums total_seconds across all servers per player, joins with the player
   * table for discord_id and minecraft_username.
   *
   * @param limit - Maximum number of entries to return (default: 1)
   * @returns Array of global leaderboard entries sorted by total playtime descending
   */
  async getGlobalLeaderboard(
    limit: number = 1,
  ): Promise<GlobalLeaderboardEntry[]> {
    const query = `
      SELECT
        p.discord_id,
        p.minecraft_username,
        s.player_minecraft_uuid,
        SUM(s.total_seconds)::bigint AS total_seconds
      FROM ${this.table} s
      JOIN player p ON p.minecraft_uuid = s.player_minecraft_uuid
      GROUP BY p.discord_id, p.minecraft_username, s.player_minecraft_uuid
      ORDER BY total_seconds DESC
      LIMIT $1`;

    const result = await this.runQuery("get global leaderboard", query, [
      limit,
    ]);

    return result.rows.map((row) => ({
      discordId: row.discord_id,
      minecraftUsername: row.minecraft_username,
      playerMinecraftUuid: row.player_minecraft_uuid,
      totalSeconds: Number(row.total_seconds),
    }));
  }
}
