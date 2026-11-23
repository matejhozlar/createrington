import type { Pool, PoolClient } from "pg";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { ServerPartyAllyBaseQueries } from "@/generated/db/server_party_ally.queries";

export interface PartyAllyWithPlayerRow {
  minecraft_uuid: string;
  minecraft_username: string | null;
}

export type PartyAllyWithPlayer = CamelCaseKeys<PartyAllyWithPlayerRow>;

export class ServerPartyAllyQueries extends ServerPartyAllyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Allies of a party with their player name, by name. */
  async getWithPlayers(partyId: number): Promise<PartyAllyWithPlayer[]> {
    const result = await this.runQuery<PartyAllyWithPlayerRow>(
      "get party allies with players",
      `SELECT a.minecraft_uuid, p.minecraft_username
      FROM ${this.table} a
      LEFT JOIN player p ON p.minecraft_uuid = a.minecraft_uuid
      WHERE a.party_id = $1
      ORDER BY LOWER(p.minecraft_username) ASC NULLS LAST, a.minecraft_uuid ASC`,
      [partyId],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
