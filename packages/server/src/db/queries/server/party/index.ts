import type { Pool, PoolClient } from "pg";
import type { PartyMemberRank } from "@createrington/shared/party";
import { ServerPartyBaseQueries } from "@/generated/db/server_party.queries";
import { escapeLike } from "@/db/utils";

export interface PartyOverview {
  id: number;
  teamId: string;
  name: string;
  description: string;
  color: number;
  freeToJoin: boolean;
  ownerUuid: string;
  ownerName: string | null;
  tagCode: string | null;
  tag: string | null;
  memberCount: number;
  allyCount: number;
  claimCount: number | null;
  forceloadCount: number | null;
  firstSeenAt: Date;
  syncedAt: Date;
}

export interface PartyMembership extends PartyOverview {
  rank: PartyMemberRank;
}

export interface MemberTagCode {
  minecraftUuid: string;
  tagCode: string;
}

export interface PartyStats {
  parties: number;
  taggedParties: number;
  players: number;
  claimCount: number | null;
  forceloadCount: number | null;
  lastSyncedAt: Date | null;
  claimsSyncedAt: Date | null;
}

const OVERVIEW_COLUMNS = `
        p.id,
        p.team_id AS "teamId",
        p.name,
        p.description,
        p.color,
        p.free_to_join AS "freeToJoin",
        p.owner_uuid AS "ownerUuid",
        o.minecraft_username AS "ownerName",
        p.tag_code AS "tagCode",
        p.tag,
        COALESCE(m.member_count, 0)::int AS "memberCount",
        COALESCE(a.ally_count, 0)::int AS "allyCount",
        CASE WHEN cs.id IS NULL THEN m.claim_count ELSE c.claim_count END::int AS "claimCount",
        CASE WHEN cs.id IS NULL THEN m.forceload_count ELSE c.forceload_count END::int AS "forceloadCount",
        p.first_seen_at AS "firstSeenAt",
        p.synced_at AS "syncedAt"`;

const OVERVIEW_JOINS = `
      FROM server_party p
      LEFT JOIN player o ON o.minecraft_uuid = p.owner_uuid
      LEFT JOIN server_party_claim_sync cs ON cs.server_id = p.server_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS member_count,
          SUM(claim_count) AS claim_count,
          SUM(forceload_count) AS forceload_count
        FROM server_party_member
        WHERE party_id = p.id
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS claim_count,
          COUNT(*) FILTER (WHERE forceloaded) AS forceload_count
        FROM server_party_claim
        WHERE server_id = p.server_id AND owner_uuid = p.owner_uuid
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS ally_count
        FROM server_party_ally
        WHERE party_id = p.id
      ) a ON true`;

const OVERVIEW_ORDER = `ORDER BY LOWER(p.name) ASC, p.id ASC`;

/**
 * Queries over the FTB Teams parties core syncs into server_party, joined
 * with the player table for names where a row exists.
 */
export class ServerPartyQueries extends ServerPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Every party of a server with owner name, member, ally and chunk counts, ordered by name. */
  async getOverview(serverId: number): Promise<PartyOverview[]> {
    const result = await this.db.query<PartyOverview>(
      `SELECT ${OVERVIEW_COLUMNS}
      ${OVERVIEW_JOINS}
      WHERE p.server_id = $1
      ${OVERVIEW_ORDER}`,
      [serverId],
    );
    return result.rows;
  }

  /** The party a player is a member of, with their rank, or null. */
  async getForMember(
    serverId: number,
    minecraftUuid: string,
  ): Promise<PartyMembership | null> {
    const result = await this.db.query<PartyMembership>(
      `SELECT ${OVERVIEW_COLUMNS},
        pm.rank
      ${OVERVIEW_JOINS}
      JOIN server_party_member pm
        ON pm.party_id = p.id AND pm.minecraft_uuid = $2
      WHERE p.server_id = $1
      ${OVERVIEW_ORDER}
      LIMIT 1`,
      [serverId, minecraftUuid],
    );
    return result.rows[0] ?? null;
  }

  /** The parties a player holds the ally rank in, ordered by name. */
  async getForAlly(
    serverId: number,
    minecraftUuid: string,
  ): Promise<PartyOverview[]> {
    const result = await this.db.query<PartyOverview>(
      `SELECT ${OVERVIEW_COLUMNS}
      ${OVERVIEW_JOINS}
      WHERE p.server_id = $1
        AND EXISTS (
          SELECT 1 FROM server_party_ally f
          WHERE f.party_id = p.id AND f.minecraft_uuid = $2
        )
      ${OVERVIEW_ORDER}`,
      [serverId, minecraftUuid],
    );
    return result.rows;
  }

  /** Server-wide totals for the admin Parties page. */
  async getStats(serverId: number): Promise<PartyStats> {
    const result = await this.db.query<PartyStats>(
      `SELECT
        COUNT(*)::int AS "parties",
        COUNT(*) FILTER (WHERE p.tag IS NOT NULL)::int AS "taggedParties",
        (SELECT COUNT(DISTINCT m.minecraft_uuid)::int
          FROM server_party_member m
          JOIN server_party mp ON mp.id = m.party_id
          WHERE mp.server_id = $1) AS "players",
        CASE WHEN EXISTS (SELECT 1 FROM server_party_claim_sync cs WHERE cs.server_id = $1) THEN
          (SELECT COUNT(*)::int FROM server_party_claim c WHERE c.server_id = $1)
        ELSE
          (SELECT SUM(m.claim_count)::int
            FROM server_party_member m
            JOIN server_party mp ON mp.id = m.party_id
            WHERE mp.server_id = $1)
        END AS "claimCount",
        CASE WHEN EXISTS (SELECT 1 FROM server_party_claim_sync cs WHERE cs.server_id = $1) THEN
          (SELECT COUNT(*)::int FROM server_party_claim c
            WHERE c.server_id = $1 AND c.forceloaded)
        ELSE
          (SELECT SUM(m.forceload_count)::int
            FROM server_party_member m
            JOIN server_party mp ON mp.id = m.party_id
            WHERE mp.server_id = $1)
        END AS "forceloadCount",
        MAX(p.synced_at) AS "lastSyncedAt",
        (SELECT cs.synced_at FROM server_party_claim_sync cs WHERE cs.server_id = $1) AS "claimsSyncedAt"
      FROM server_party p
      WHERE p.server_id = $1`,
      [serverId],
    );
    return result.rows[0];
  }

  /** Parties whose name contains the query, for autocompletes. */
  async searchByName(
    serverId: number,
    query: string,
    limit = 25,
  ): Promise<{ teamId: string; name: string; memberCount: number }[]> {
    const trimmed = query.trim();
    const result = await this.db.query<{
      teamId: string;
      name: string;
      memberCount: number;
    }>(
      `SELECT
        p.team_id AS "teamId",
        p.name,
        (SELECT COUNT(*)::int FROM server_party_member m WHERE m.party_id = p.id) AS "memberCount"
      FROM server_party p
      WHERE p.server_id = $1
        AND ($2 = '' OR p.name ILIKE $3)
      ORDER BY LOWER(p.name) ASC
      LIMIT $4`,
      [serverId, trimmed, `%${escapeLike(trimmed)}%`, limit],
    );
    return result.rows;
  }

  /** Design codes of the tagged parties the given players are members of, one row per tagged player. */
  async getMemberTagCodes(
    serverId: number,
    minecraftUuids: string[],
  ): Promise<MemberTagCode[]> {
    if (minecraftUuids.length === 0) return [];
    const result = await this.db.query<MemberTagCode>(
      `SELECT
        pm.minecraft_uuid AS "minecraftUuid",
        p.tag_code AS "tagCode"
      FROM server_party_member pm
      JOIN server_party p ON p.id = pm.party_id
      WHERE p.server_id = $1
        AND p.tag_code IS NOT NULL
        AND pm.minecraft_uuid = ANY($2::uuid[])`,
      [serverId, minecraftUuids],
    );
    return result.rows;
  }
}
