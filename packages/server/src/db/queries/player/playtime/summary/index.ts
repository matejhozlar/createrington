import { Pool, PoolClient } from "pg";
import { PlayerPlaytimeSummaryBaseQueries } from "@/generated/db/player_playtime_summary.queries";

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

/**
 * Custom queries for player_playtime_summary table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerPlaytimeSummaryQueries extends PlayerPlaytimeSummaryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here

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

    try {
      const result = await this.db.query(query, [serverId, limit]);

      return result.rows.map((row) => ({
        ...this.mapRowToEntity(row),
        minecraftUsername: row.minecraft_username,
      }));
    } catch (error) {
      logger.error("Failed to get leaderboard:", error);
      throw error;
    }
  }

  /**
   * Retrieves aggregated statistics for a server
   *
   * Calculates server-wide metrics including total unique players,
   * cumulative playtime, total sessions, and avarage session duration
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

    try {
      const result = await this.db.query(query, [serverId]);

      return this.mapRowToEntity<any, ServerStats>(result.rows[0]);
    } catch (error) {
      logger.error("Failed to get server stats:", error);
      throw error;
    }
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

    try {
      const result = await this.db.query(query, [playerMinecraftUuid]);

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
        lastSeen: new Date(
          Math.max(...servers.map((s) => s.lastSeen.getTime())),
        ),
      };

      return {
        playerMinecraftUuid,
        servers,
        totals,
      };
    } catch (error) {
      logger.error("Failed to get playtime breakdown:", error);
      throw error;
    }
  }
}
