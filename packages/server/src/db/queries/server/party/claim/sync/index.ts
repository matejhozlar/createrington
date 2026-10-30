import type { Pool, PoolClient } from "pg";
import { ServerPartyClaimSyncBaseQueries } from "@/generated/db/server_party_claim_sync.queries";

/**
 * Custom queries for server_party_claim_sync table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerPartyClaimSyncQueries extends ServerPartyClaimSyncBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerPartyClaimSync[]> {
  //   const result = await this.db.query<ServerPartyClaimSync>(
  //     `SELECT * FROM server_party_claim_sync WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
