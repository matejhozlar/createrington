import type { Pool, PoolClient } from "pg";
import type { PartyMemberRank } from "@createrington/shared/party";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { ServerPartyBaseQueries } from "@/generated/db/server_party.queries";
import { escapeLike } from "@/db/utils";

export interface PartyOverviewRow {
  id: number;
  team_id: string;
  name: string;
  description: string;
  color: number;
  free_to_join: boolean;
  owner_uuid: string;
  owner_name: string | null;
  tag_code: string | null;
  tag: string | null;
  member_count: number;
  ally_count: number;
  claim_count: number | null;
  forceload_count: number | null;
  first_seen_at: Date;
  synced_at: Date;
}

export interface PartyMembershipRow extends PartyOverviewRow {
  rank: PartyMemberRank;
}

export interface MemberTagCodeRow {
  minecraft_uuid: string;
  tag_code: string;
}

export interface PartyStatsRow {
  parties: number;
  tagged_parties: number;
  players: number;
  claim_count: number | null;
  forceload_count: number | null;
  last_synced_at: Date | null;
  claims_synced_at: Date | null;
}

export type PartyOverview = CamelCaseKeys<PartyOverviewRow>;

export type PartyMembership = CamelCaseKeys<PartyMembershipRow>;

export type MemberTagCode = CamelCaseKeys<MemberTagCodeRow>;

export type PartyStats = CamelCaseKeys<PartyStatsRow>;

const OVERVIEW_COLUMNS = `
        p.id,
        p.team_id,
        p.name,
        p.description,
        p.color,
        p.free_to_join,
        p.owner_uuid,
        o.minecraft_username AS owner_name,
        p.tag_code,
        p.tag,
        COALESCE(m.member_count, 0)::int AS member_count,
        COALESCE(a.ally_count, 0)::int AS ally_count,
        CASE WHEN cs.id IS NULL THEN m.claim_count ELSE c.claim_count END::int AS claim_count,
        CASE WHEN cs.id IS NULL THEN m.forceload_count ELSE c.forceload_count END::int AS forceload_count,
        p.first_seen_at,
        p.synced_at`;

const OVERVIEW_JOINS = `
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
    const result = await this.runQuery<PartyOverviewRow>(
      "get party overview",
      `SELECT ${OVERVIEW_COLUMNS}
      FROM ${this.table} p
      ${OVERVIEW_JOINS}
      WHERE p.server_id = $1
      ${OVERVIEW_ORDER}`,
      [serverId],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /** The party a player is a member of, with their rank, or null. */
  async findForMember(
    serverId: number,
    minecraftUuid: string,
  ): Promise<PartyMembership | null> {
    const result = await this.runQuery<PartyMembershipRow>(
      "get party for member",
      `SELECT ${OVERVIEW_COLUMNS},
        pm.rank
      FROM ${this.table} p
      ${OVERVIEW_JOINS}
      JOIN server_party_member pm
        ON pm.party_id = p.id AND pm.minecraft_uuid = $2
      WHERE p.server_id = $1
      ${OVERVIEW_ORDER}
      LIMIT 1`,
      [serverId, minecraftUuid],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /** The parties a player holds the ally rank in, ordered by name. */
  async getForAlly(
    serverId: number,
    minecraftUuid: string,
  ): Promise<PartyOverview[]> {
    const result = await this.runQuery<PartyOverviewRow>(
      "get parties for ally",
      `SELECT ${OVERVIEW_COLUMNS}
      FROM ${this.table} p
      ${OVERVIEW_JOINS}
      WHERE p.server_id = $1
        AND EXISTS (
          SELECT 1 FROM server_party_ally f
          WHERE f.party_id = p.id AND f.minecraft_uuid = $2
        )
      ${OVERVIEW_ORDER}`,
      [serverId, minecraftUuid],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /** Server-wide totals for the admin Parties page. */
  async getStats(serverId: number): Promise<PartyStats> {
    const result = await this.runQuery<PartyStatsRow>(
      "get party stats",
      `SELECT
        COUNT(*)::int AS parties,
        COUNT(*) FILTER (WHERE p.tag IS NOT NULL)::int AS tagged_parties,
        (SELECT COUNT(DISTINCT m.minecraft_uuid)::int
          FROM server_party_member m
          JOIN server_party mp ON mp.id = m.party_id
          WHERE mp.server_id = $1) AS players,
        CASE WHEN EXISTS (SELECT 1 FROM server_party_claim_sync cs WHERE cs.server_id = $1) THEN
          (SELECT COUNT(*)::int FROM server_party_claim c WHERE c.server_id = $1)
        ELSE
          (SELECT SUM(m.claim_count)::int
            FROM server_party_member m
            JOIN server_party mp ON mp.id = m.party_id
            WHERE mp.server_id = $1)
        END AS claim_count,
        CASE WHEN EXISTS (SELECT 1 FROM server_party_claim_sync cs WHERE cs.server_id = $1) THEN
          (SELECT COUNT(*)::int FROM server_party_claim c
            WHERE c.server_id = $1 AND c.forceloaded)
        ELSE
          (SELECT SUM(m.forceload_count)::int
            FROM server_party_member m
            JOIN server_party mp ON mp.id = m.party_id
            WHERE mp.server_id = $1)
        END AS forceload_count,
        MAX(p.synced_at) AS last_synced_at,
        (SELECT cs.synced_at FROM server_party_claim_sync cs WHERE cs.server_id = $1) AS claims_synced_at
      FROM ${this.table} p
      WHERE p.server_id = $1`,
      [serverId],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Parties whose name contains the query, for autocompletes. */
  async getNameMatches(
    serverId: number,
    query: string,
    limit = 25,
  ): Promise<{ teamId: string; name: string; memberCount: number }[]> {
    const trimmed = query.trim();
    const result = await this.runQuery<{
      team_id: string;
      name: string;
      member_count: number;
    }>(
      "search parties by name",
      `SELECT
        p.team_id,
        p.name,
        (SELECT COUNT(*)::int FROM server_party_member m WHERE m.party_id = p.id) AS member_count
      FROM ${this.table} p
      WHERE p.server_id = $1
        AND ($2 = '' OR p.name ILIKE $3)
      ORDER BY LOWER(p.name) ASC
      LIMIT $4`,
      [serverId, trimmed, `%${escapeLike(trimmed)}%`, limit],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /** Tagged parties whose name or tag contains the query, for autocompletes. */
  async getTaggedMatches(
    serverId: number,
    query: string,
    limit = 25,
  ): Promise<{ teamId: string; name: string; tag: string }[]> {
    const trimmed = query.trim();
    const result = await this.runQuery<{
      team_id: string;
      name: string;
      tag: string;
    }>(
      "search tagged parties",
      `SELECT p.team_id, p.name, p.tag
      FROM ${this.table} p
      WHERE p.server_id = $1
        AND p.tag_code IS NOT NULL
        AND ($2 = '' OR p.name ILIKE $3 OR p.tag ILIKE $3)
      ORDER BY LOWER(p.name) ASC
      LIMIT $4`,
      [serverId, trimmed, `%${escapeLike(trimmed)}%`, limit],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /** Design codes of the tagged parties the given players are members of, one row per tagged player. */
  async getMemberTagCodes(
    serverId: number,
    minecraftUuids: string[],
  ): Promise<MemberTagCode[]> {
    if (minecraftUuids.length === 0) return [];
    const result = await this.runQuery<MemberTagCodeRow>(
      "get member tag codes",
      `SELECT pm.minecraft_uuid, p.tag_code
      FROM server_party_member pm
      JOIN ${this.table} p ON p.id = pm.party_id
      WHERE p.server_id = $1
        AND p.tag_code IS NOT NULL
        AND pm.minecraft_uuid = ANY($2::uuid[])`,
      [serverId, minecraftUuids],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
