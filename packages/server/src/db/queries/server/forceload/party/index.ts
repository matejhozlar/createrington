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
    }>(
      `SELECT
        fp.id,
        fp.party_id AS "partyId",
        fp.party_name AS "partyName",
        fp.member_count AS "memberCount",
        fp.opted_in AS "optedIn",
        fp.synced_at AS "syncedAt",
        COUNT(fc.id)::int AS "totalChunks",
        COUNT(fc.id) FILTER (WHERE fc.active)::int AS "activeChunks"
      FROM server_forceload_party fp
      LEFT JOIN server_forceload_chunk fc ON fc.party_id = fp.id
      WHERE fp.server_id = $1
      GROUP BY fp.id, fp.party_id, fp.party_name, fp.member_count, fp.opted_in, fp.synced_at
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
