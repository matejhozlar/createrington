import type { Pool, PoolClient } from "pg";
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

export interface PartyKpis {
  parties: number;
  taggedParties: number;
  players: number;
  claimCount: number | null;
  forceloadCount: number | null;
  lastSyncedAt: Date | null;
}

export interface PartyOverviewFilter {
  memberUuid?: string;
  allyUuid?: string;
}

/**
 * Queries over the FTB Teams parties core syncs into server_party, joined
 * with the player table for names where a row exists.
 */
export class ServerPartyQueries extends ServerPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Every party of a server with owner name, member, ally and chunk counts, ordered by name. */
  async getOverview(
    serverId: number,
    filter: PartyOverviewFilter = {},
  ): Promise<PartyOverview[]> {
    const params: unknown[] = [serverId];
    const conditions = ["p.server_id = $1"];
    if (filter.memberUuid) {
      params.push(filter.memberUuid);
      conditions.push(
        `EXISTS (SELECT 1 FROM server_party_member f WHERE f.party_id = p.id AND f.minecraft_uuid = $${params.length})`,
      );
    }
    if (filter.allyUuid) {
      params.push(filter.allyUuid);
      conditions.push(
        `EXISTS (SELECT 1 FROM server_party_ally f WHERE f.party_id = p.id AND f.minecraft_uuid = $${params.length})`,
      );
    }

    const result = await this.db.query<PartyOverview>(
      `SELECT
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
        m.claim_count::int AS "claimCount",
        m.forceload_count::int AS "forceloadCount",
        p.first_seen_at AS "firstSeenAt",
        p.synced_at AS "syncedAt"
      FROM server_party p
      LEFT JOIN player o ON o.minecraft_uuid = p.owner_uuid
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS member_count,
          SUM(claim_count) AS claim_count,
          SUM(forceload_count) AS forceload_count
        FROM server_party_member
        WHERE party_id = p.id
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS ally_count
        FROM server_party_ally
        WHERE party_id = p.id
      ) a ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY LOWER(p.name) ASC, p.id ASC`,
      params,
    );
    return result.rows;
  }

  /** Server-wide totals for the admin Parties page. */
  async getKpis(serverId: number): Promise<PartyKpis> {
    const result = await this.db.query<PartyKpis>(
      `SELECT
        COUNT(*)::int AS "parties",
        COUNT(*) FILTER (WHERE p.tag IS NOT NULL)::int AS "taggedParties",
        (SELECT COUNT(DISTINCT m.minecraft_uuid)::int
          FROM server_party_member m
          JOIN server_party mp ON mp.id = m.party_id
          WHERE mp.server_id = $1) AS "players",
        (SELECT SUM(m.claim_count)::int
          FROM server_party_member m
          JOIN server_party mp ON mp.id = m.party_id
          WHERE mp.server_id = $1) AS "claimCount",
        (SELECT SUM(m.forceload_count)::int
          FROM server_party_member m
          JOIN server_party mp ON mp.id = m.party_id
          WHERE mp.server_id = $1) AS "forceloadCount",
        MAX(p.synced_at) AS "lastSyncedAt"
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
}
