import type { Pool, PoolClient } from "pg";
import { ServerPartyBaseQueries } from "@/generated/db/server_party.queries";

/**
 * Custom queries for server_party table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerPartyQueries extends ServerPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerParty[]> {
  //   const result = await this.db.query<ServerParty>(
  //     `SELECT * FROM server_party WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
