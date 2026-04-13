import type { Pool, PoolClient } from "pg";
import { ServerForceloadPlayerBaseQueries } from "@/generated/db/server_forceload_player.queries";

export class ServerForceloadPlayerQueries extends ServerForceloadPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
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
