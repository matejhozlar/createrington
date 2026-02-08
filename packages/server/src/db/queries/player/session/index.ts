import type { Pool, PoolClient } from "pg";
import { PlayerSessionBaseQueries } from "@/generated/db/player_session.queries";

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
 * Extends the auto-generated base class with custom methods
 */
export class PlayerSessionQueries extends PlayerSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get paginated sessions for a specific server with player usernames
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
        (row: any) => ({
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
