import type { Pool, PoolClient } from "pg";
import { ServerForceloadPartyBaseQueries } from "@/generated/db/server_forceload_party.queries";

/**
 * Custom queries for server_forceload_party table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerForceloadPartyQueries extends ServerForceloadPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerForceloadParty[]> {
  //   const result = await this.db.query<ServerForceloadParty>(
  //     `SELECT * FROM server_forceload_party WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
