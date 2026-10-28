import type { Pool, PoolClient } from "pg";
import { ServerPartyAllyBaseQueries } from "@/generated/db/server_party_ally.queries";

export interface PartyAllyWithPlayer {
  minecraftUuid: string;
  minecraftUsername: string | null;
}

export class ServerPartyAllyQueries extends ServerPartyAllyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Allies of a party with their player name, by name. */
  async getWithPlayers(partyId: number): Promise<PartyAllyWithPlayer[]> {
    const result = await this.db.query<PartyAllyWithPlayer>(
      `SELECT
        a.minecraft_uuid AS "minecraftUuid",
        p.minecraft_username AS "minecraftUsername"
      FROM server_party_ally a
      LEFT JOIN player p ON p.minecraft_uuid = a.minecraft_uuid
      WHERE a.party_id = $1
      ORDER BY LOWER(p.minecraft_username) ASC NULLS LAST, a.minecraft_uuid ASC`,
      [partyId],
    );
    return result.rows;
  }
}
