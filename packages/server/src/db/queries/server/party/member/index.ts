import type { Pool, PoolClient } from "pg";
import { ServerPartyMemberBaseQueries } from "@/generated/db/server_party_member.queries";

/**
 * Custom queries for server_party_member table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerPartyMemberQueries extends ServerPartyMemberBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerPartyMember[]> {
  //   const result = await this.db.query<ServerPartyMember>(
  //     `SELECT * FROM server_party_member WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
