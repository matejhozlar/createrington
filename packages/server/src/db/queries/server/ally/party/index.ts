import type { Pool, PoolClient } from "pg";
import { ServerAllyPartyBaseQueries } from "@/generated/db/server_ally_party.queries";

export class ServerAllyPartyQueries extends ServerAllyPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getAlliedPartiesForParty(serverId: number, partyId: string) {
    const result = await this.db.query<{
      partyId: string;
      partyName: string | null;
      memberCount: number | null;
      alliedAt: Date;
    }>(
      `SELECT
        ap.party_id AS "partyId",
        fp.party_name AS "partyName",
        fp.member_count AS "memberCount",
        ap.allied_at AS "alliedAt"
      FROM server_ally_party ap
      LEFT JOIN server_forceload_party fp
        ON fp.party_id = ap.party_id AND fp.server_id = ap.server_id
      WHERE ap.server_id = $1 AND ap.party_id != $2
      ORDER BY fp.party_name ASC NULLS LAST`,
      [serverId, partyId],
    );
    return result.rows;
  }
}
