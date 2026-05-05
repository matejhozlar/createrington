import type { Pool, PoolClient } from "pg";
import { ServerForceloadPartyBaseQueries } from "@/generated/db/server_forceload_party.queries";
import { EXPIRED_CLAIM_UUID } from "@/db/schema/server";
import { escapeLike } from "@/db/utils";

export class ServerForceloadPartyQueries extends ServerForceloadPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async searchByName(serverId: number, query: string, limit = 25) {
    const trimmed = query.trim();
    const result = await this.db.query<{
      partyUuid: string;
      partyName: string;
      memberCount: number;
    }>(
      `SELECT
        fp.party_id AS "partyUuid",
        fp.party_name AS "partyName",
        fp.member_count AS "memberCount"
      FROM server_forceload_party fp
      WHERE fp.server_id = $1
        AND ($2 = '' OR fp.party_name ILIKE $3)
      ORDER BY fp.party_name ASC
      LIMIT $4`,
      [serverId, trimmed, `%${escapeLike(trimmed)}%`, limit],
    );
    return result.rows;
  }

  async getPartyMembers(
    serverId: number,
    partyUuid: string,
  ): Promise<{
    partyName: string | null;
    memberUuids: string[];
  } | null> {
    const result = await this.db.query<{
      partyName: string | null;
      memberUuids: string[];
    }>(
      `SELECT
        fp.party_name AS "partyName",
        COALESCE(
          ARRAY_AGG(fm.player_uuid) FILTER (WHERE fm.player_uuid IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS "memberUuids"
      FROM server_forceload_party fp
      LEFT JOIN server_forceload_member fm ON fm.party_id = fp.id
      WHERE fp.server_id = $1 AND fp.party_id = $2
      GROUP BY fp.id, fp.party_name`,
      [serverId, partyUuid],
    );
    return result.rows[0] ?? null;
  }

  // OPAC may delete + recreate a party row across syncs, giving it a new
  // serial id. Lookups must use the stable party UUID so an expand triggered
  // mid-sync still resolves to the current row.
  async getUnifiedList(serverId: number) {
    const result = await this.db.query<{
      partyUuid: string;
      partyName: string;
      memberCount: number;
      optedIn: boolean;
      syncedAt: Date;
      totalChunks: number;
      activeChunks: number;
      chunksByDimension: Record<string, { total: number; active: number }>;
      isAllied: boolean;
      alliedAt: Date | null;
    }>(
      `SELECT
        fp.party_id AS "partyUuid",
        fp.party_name AS "partyName",
        fp.member_count AS "memberCount",
        fp.opted_in AS "optedIn",
        fp.synced_at AS "syncedAt",
        COALESCE(c.total_chunks, 0) AS "totalChunks",
        COALESCE(c.active_chunks, 0) AS "activeChunks",
        COALESCE(c.chunks_by_dimension, '{}'::jsonb) AS "chunksByDimension",
        ap.party_id IS NOT NULL AS "isAllied",
        ap.allied_at AS "alliedAt"
      FROM server_forceload_party fp
      LEFT JOIN server_ally_party ap
        ON ap.party_id = fp.party_id AND ap.server_id = fp.server_id
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
      ORDER BY "totalChunks" DESC, fp.party_name ASC`,
      [serverId],
    );
    return result.rows;
  }

  async getMembersWithChunkStats(serverId: number, partyUuid: string) {
    const result = await this.db.query<{
      playerUuid: string;
      minecraftUsername: string | null;
      hasSoloForceloads: boolean;
      totalChunks: number;
      activeChunks: number;
    }>(
      `SELECT
        fm.player_uuid AS "playerUuid",
        p.minecraft_username AS "minecraftUsername",
        sfp.id IS NOT NULL AS "hasSoloForceloads",
        COALESCE(c.total_chunks, 0) AS "totalChunks",
        COALESCE(c.active_chunks, 0) AS "activeChunks"
      FROM server_forceload_party fp
      JOIN server_forceload_member fm ON fm.party_id = fp.id
      LEFT JOIN player p ON p.minecraft_uuid = fm.player_uuid
      LEFT JOIN server_forceload_player sfp
        ON sfp.player_uuid = fm.player_uuid AND sfp.server_id = fp.server_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total_chunks,
          COUNT(*) FILTER (WHERE active)::int AS active_chunks
        FROM server_forceload_chunk
        WHERE player_id = sfp.id
      ) c ON true
      WHERE fp.server_id = $1 AND fp.party_id = $2
      ORDER BY p.minecraft_username ASC NULLS LAST`,
      [serverId, partyUuid],
    );
    return result.rows;
  }

  // alliedPlayers and notQualifiedPlayers form a server-wide funnel for the
  // "Allied with Fake Player" admin KPI: allied (today), pending (in review),
  // not qualified (every other chunk owner). The pending and notQualified
  // counts are outside alliedPlayers, not a subset of it.
  async getKpis(serverId: number) {
    const result = await this.db.query<{
      totalParties: number;
      alliedParties: number;
      partiesWithActiveForceloads: number;
      qualifiedActive: number;
      qualifiedPending: number;
      alliedPlayers: number;
      notQualifiedPlayers: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM server_forceload_party WHERE server_id = $1) AS "totalParties",
        (SELECT COUNT(*)::int FROM server_ally_party WHERE server_id = $1) AS "alliedParties",
        (SELECT COUNT(DISTINCT fp.id)::int
          FROM server_forceload_party fp
          JOIN server_forceload_chunk fc ON fc.party_id = fp.id AND fc.active
          WHERE fp.server_id = $1) AS "partiesWithActiveForceloads",
        (SELECT COUNT(*)::int FROM server_ally_qualified_player
          WHERE server_id = $1 AND is_pending = false) AS "qualifiedActive",
        (SELECT COUNT(*)::int FROM server_ally_qualified_player
          WHERE server_id = $1 AND is_pending = true) AS "qualifiedPending",
        (SELECT COUNT(DISTINCT player_uuid)::int FROM (
          SELECT m.player_uuid
          FROM server_ally_fake_party fp
          JOIN server_ally_fake_party_member m ON m.fake_party_id = fp.id
          WHERE fp.server_id = $1
          UNION
          SELECT sc.player_uuid
          FROM server_ally_party ap
          JOIN server_chunk sc ON sc.party_id = ap.party_id AND sc.server_id = ap.server_id
          WHERE ap.server_id = $1 AND sc.player_uuid != $2
        ) sub) AS "alliedPlayers",
        (SELECT COUNT(DISTINCT sc.player_uuid)::int
          FROM server_chunk sc
          WHERE sc.server_id = $1
            AND sc.player_uuid != $2
            AND NOT EXISTS (
              SELECT 1 FROM server_ally_qualified_player q
              WHERE q.server_id = $1 AND q.player_uuid = sc.player_uuid
            )
        ) AS "notQualifiedPlayers"`,
      [serverId, EXPIRED_CLAIM_UUID],
    );
    return result.rows[0];
  }
}
