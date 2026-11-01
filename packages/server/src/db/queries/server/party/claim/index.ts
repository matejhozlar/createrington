import type { Pool, PoolClient } from "pg";
import { ServerPartyClaimBaseQueries } from "@/generated/db/server_party_claim.queries";

export interface ClaimDimensionTotals {
  dimension: string;
  claimCount: number;
  forceloadCount: number;
}

/**
 * Queries over the OPAC claimed chunks core syncs into server_party_claim.
 * Chunks are filed under the UUID OPAC stores them with, which is the party
 * owner's UUID for party-owned claims.
 */
export class ServerPartyClaimQueries extends ServerPartyClaimBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Claimed and forceloaded chunk counts of an owner per dimension, most claims first. */
  async getDimensionTotals(
    serverId: number,
    ownerUuid: string,
  ): Promise<ClaimDimensionTotals[]> {
    const result = await this.db.query<ClaimDimensionTotals>(
      `SELECT
        dimension,
        COUNT(*)::int AS "claimCount",
        COUNT(*) FILTER (WHERE forceloaded)::int AS "forceloadCount"
      FROM server_party_claim
      WHERE server_id = $1 AND owner_uuid = $2
      GROUP BY dimension
      ORDER BY "claimCount" DESC, dimension ASC`,
      [serverId, ownerUuid],
    );
    return result.rows;
  }
}
