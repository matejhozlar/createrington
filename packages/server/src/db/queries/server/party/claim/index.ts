import type { Pool, PoolClient } from "pg";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { ServerPartyClaimBaseQueries } from "@/generated/db/server_party_claim.queries";

export interface ClaimDimensionTotalsRow {
  dimension: string;
  claim_count: number;
  forceload_count: number;
}

export type ClaimDimensionTotals = CamelCaseKeys<ClaimDimensionTotalsRow>;

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
    const result = await this.runQuery<ClaimDimensionTotalsRow>(
      "get claim dimension totals",
      `SELECT
        dimension,
        COUNT(*)::int AS claim_count,
        COUNT(*) FILTER (WHERE forceloaded)::int AS forceload_count
      FROM ${this.table}
      WHERE server_id = $1 AND owner_uuid = $2
      GROUP BY dimension
      ORDER BY claim_count DESC, dimension ASC`,
      [serverId, ownerUuid],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
