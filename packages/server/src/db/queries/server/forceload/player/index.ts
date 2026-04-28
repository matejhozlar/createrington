import type { Pool, PoolClient } from "pg";
import { ServerForceloadPlayerBaseQueries } from "@/generated/db/server_forceload_player.queries";

export class ServerForceloadPlayerQueries extends ServerForceloadPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getStats(serverId: number) {
    const result = await this.db.query<{
      totalPlayers: number;
      totalParties: number;
      totalChunks: number;
      activeChunks: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM server_forceload_player WHERE server_id = $1) AS "totalPlayers",
        (SELECT COUNT(*)::int FROM server_forceload_party WHERE server_id = $1) AS "totalParties",
        (SELECT COUNT(*)::int FROM server_forceload_chunk fc
          WHERE fc.player_id IN (SELECT id FROM server_forceload_player WHERE server_id = $1)
             OR fc.party_id IN (SELECT id FROM server_forceload_party WHERE server_id = $1)
        ) AS "totalChunks",
        (SELECT COUNT(*)::int FROM server_forceload_chunk fc
          WHERE fc.active
            AND (fc.player_id IN (SELECT id FROM server_forceload_player WHERE server_id = $1)
              OR fc.party_id IN (SELECT id FROM server_forceload_party WHERE server_id = $1))
        ) AS "activeChunks"`,
      [serverId],
    );
    return result.rows[0];
  }

  async getPlayersWithChunks(serverId: number) {
    const result = await this.db.query<{
      id: number;
      playerUuid: string;
      syncedAt: Date;
      minecraftUsername: string | null;
      totalChunks: number;
      activeChunks: number;
      chunksByDimension: Record<string, { total: number; active: number }>;
    }>(
      `SELECT
        fp.id,
        fp.player_uuid AS "playerUuid",
        fp.synced_at AS "syncedAt",
        p.minecraft_username AS "minecraftUsername",
        COALESCE(c.total_chunks, 0) AS "totalChunks",
        COALESCE(c.active_chunks, 0) AS "activeChunks",
        COALESCE(c.chunks_by_dimension, '{}'::jsonb) AS "chunksByDimension"
      FROM server_forceload_player fp
      LEFT JOIN player p ON p.minecraft_uuid = fp.player_uuid
      LEFT JOIN LATERAL (
        SELECT
          SUM(dim_total)::int AS total_chunks,
          SUM(dim_active)::int AS active_chunks,
          JSONB_OBJECT_AGG(
            dimension,
            JSONB_BUILD_OBJECT('total', dim_total, 'active', dim_active)
          ) AS chunks_by_dimension
        FROM (
          SELECT
            dimension,
            COUNT(*)::int AS dim_total,
            COUNT(*) FILTER (WHERE active)::int AS dim_active
          FROM server_forceload_chunk
          WHERE player_id = fp.id
          GROUP BY dimension
        ) sub
      ) c ON true
      WHERE fp.server_id = $1
      ORDER BY "totalChunks" DESC`,
      [serverId],
    );
    return result.rows;
  }
}
