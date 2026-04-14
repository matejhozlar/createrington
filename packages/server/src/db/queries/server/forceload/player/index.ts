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
    }>(
      `SELECT
        fp.id,
        fp.player_uuid AS "playerUuid",
        fp.synced_at AS "syncedAt",
        p.minecraft_username AS "minecraftUsername",
        COUNT(fc.id)::int AS "totalChunks",
        COUNT(fc.id) FILTER (WHERE fc.active)::int AS "activeChunks"
      FROM server_forceload_player fp
      LEFT JOIN server_forceload_chunk fc ON fc.player_id = fp.id
      LEFT JOIN player p ON p.minecraft_uuid = fp.player_uuid
      WHERE fp.server_id = $1
      GROUP BY fp.id, fp.player_uuid, fp.synced_at, p.minecraft_username
      ORDER BY "totalChunks" DESC`,
      [serverId],
    );
    return result.rows;
  }
}
