import type { Pool, PoolClient } from "pg";
import { ServerForceloadPartyBaseQueries } from "@/generated/db/server_forceload_party.queries";

export class ServerForceloadPartyQueries extends ServerForceloadPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getPartiesWithStats(serverId: number) {
    const result = await this.db.query<{
      id: number;
      partyId: string;
      partyName: string;
      memberCount: number;
      optedIn: boolean;
      syncedAt: Date;
      totalChunks: number;
      activeChunks: number;
      chunksByDimension: Record<string, { total: number; active: number }>;
    }>(
      `SELECT
        fp.id,
        fp.party_id AS "partyId",
        fp.party_name AS "partyName",
        fp.member_count AS "memberCount",
        fp.opted_in AS "optedIn",
        fp.synced_at AS "syncedAt",
        COALESCE(c.total_chunks, 0) AS "totalChunks",
        COALESCE(c.active_chunks, 0) AS "activeChunks",
        COALESCE(c.chunks_by_dimension, '{}'::jsonb) AS "chunksByDimension"
      FROM server_forceload_party fp
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
          WHERE party_id = fp.id
          GROUP BY dimension
        ) sub
      ) c ON true
      WHERE fp.server_id = $1
      ORDER BY "totalChunks" DESC`,
      [serverId],
    );
    return result.rows;
  }

  async getPartyMembers(partyId: number) {
    const result = await this.db.query<{
      playerUuid: string;
      minecraftUsername: string | null;
    }>(
      `SELECT
        fm.player_uuid AS "playerUuid",
        p.minecraft_username AS "minecraftUsername"
      FROM server_forceload_member fm
      LEFT JOIN player p ON p.minecraft_uuid = fm.player_uuid
      WHERE fm.party_id = $1
      ORDER BY p.minecraft_username ASC NULLS LAST`,
      [partyId],
    );
    return result.rows;
  }
}
