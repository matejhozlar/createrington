import type { Pool, PoolClient } from "pg";
import { ServerPartyAllyBaseQueries } from "@/generated/db/server_party_ally.queries";

/**
 * Custom queries for server_party_ally table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerPartyAllyQueries extends ServerPartyAllyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerPartyAlly[]> {
  //   const result = await this.db.query<ServerPartyAlly>(
  //     `SELECT * FROM server_party_ally WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
