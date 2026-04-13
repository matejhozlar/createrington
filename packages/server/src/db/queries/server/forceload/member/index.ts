import type { Pool, PoolClient } from "pg";
import { ServerForceloadMemberBaseQueries } from "@/generated/db/server_forceload_member.queries";

/**
 * Custom queries for server_forceload_member table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerForceloadMemberQueries extends ServerForceloadMemberBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerForceloadMember[]> {
  //   const result = await this.db.query<ServerForceloadMember>(
  //     `SELECT * FROM server_forceload_member WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
