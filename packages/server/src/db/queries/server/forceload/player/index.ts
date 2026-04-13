import type { Pool, PoolClient } from "pg";
import { ServerForceloadPlayerBaseQueries } from "@/generated/db/server_forceload_player.queries";

/**
 * Custom queries for server_forceload_player table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerForceloadPlayerQueries extends ServerForceloadPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerForceloadPlayer[]> {
  //   const result = await this.db.query<ServerForceloadPlayer>(
  //     `SELECT * FROM server_forceload_player WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
