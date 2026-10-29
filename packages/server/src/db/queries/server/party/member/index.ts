import type { Pool, PoolClient } from "pg";
import type { PartyMemberRank } from "@createrington/shared/party";
import { ServerPartyMemberBaseQueries } from "@/generated/db/server_party_member.queries";

export interface PartyMemberWithPlayer {
  minecraftUuid: string;
  minecraftUsername: string | null;
  rank: PartyMemberRank;
  claimCount: number | null;
  forceloadCount: number | null;
}

export class ServerPartyMemberQueries extends ServerPartyMemberBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Members of a party with their player name, owner first, then officers, then members by name. */
  async getWithPlayers(partyId: number): Promise<PartyMemberWithPlayer[]> {
    const result = await this.db.query<PartyMemberWithPlayer>(
      `SELECT
        m.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername",
        m.rank,
        m.claim_count AS "claimCount",
        m.forceload_count AS "forceloadCount"
      FROM server_party_member m
      LEFT JOIN player p ON p.minecraft_uuid = m.minecraft_uuid
      WHERE m.party_id = $1
      ORDER BY
        CASE m.rank WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
        LOWER(p.minecraft_username) ASC NULLS LAST,
        m.minecraft_uuid ASC`,
      [partyId],
    );
    return result.rows;
  }
}
