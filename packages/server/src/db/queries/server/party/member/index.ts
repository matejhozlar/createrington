import type { Pool, PoolClient } from "pg";
import type { PartyMemberRank } from "@createrington/shared/party";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { ServerPartyMemberBaseQueries } from "@/generated/db/server_party_member.queries";

export interface PartyMemberWithPlayerRow {
  minecraft_uuid: string;
  minecraft_username: string | null;
  rank: PartyMemberRank;
  claim_count: number | null;
  forceload_count: number | null;
}

export interface DepartedPartyMemberRow {
  minecraft_uuid: string;
  party_name: string;
}

export type PartyMemberWithPlayer = CamelCaseKeys<PartyMemberWithPlayerRow>;

export type DepartedPartyMember = CamelCaseKeys<DepartedPartyMemberRow>;

export class ServerPartyMemberQueries extends ServerPartyMemberBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Members of a party with their player name, owner first, then officers, then members by name. */
  async getWithPlayers(partyId: number): Promise<PartyMemberWithPlayer[]> {
    const result = await this.runQuery<PartyMemberWithPlayerRow>(
      "get party members with players",
      `SELECT
        m.minecraft_uuid,
        p.minecraft_username,
        m.rank,
        m.claim_count,
        m.forceload_count
      FROM ${this.table} m
      LEFT JOIN player p ON p.minecraft_uuid = m.minecraft_uuid
      WHERE m.party_id = $1
      ORDER BY
        CASE m.rank WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
        LOWER(p.minecraft_username) ASC NULLS LAST,
        m.minecraft_uuid ASC`,
      [partyId],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /** Members of a server's parties, owners excluded, who no longer have a player row, by party name. */
  async getDeparted(serverId: number): Promise<DepartedPartyMember[]> {
    const result = await this.runQuery<DepartedPartyMemberRow>(
      "get departed party members",
      `SELECT
        m.minecraft_uuid,
        sp.name AS party_name
      FROM ${this.table} m
      JOIN server_party sp ON sp.id = m.party_id
      LEFT JOIN player p ON p.minecraft_uuid = m.minecraft_uuid
      WHERE sp.server_id = $1
        AND m.rank <> 'owner'
        AND p.minecraft_uuid IS NULL
      ORDER BY LOWER(sp.name) ASC, m.minecraft_uuid ASC`,
      [serverId],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
