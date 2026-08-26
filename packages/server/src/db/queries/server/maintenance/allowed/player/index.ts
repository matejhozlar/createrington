import type { Pool, PoolClient } from "pg";
import { ServerMaintenanceAllowedPlayerBaseQueries } from "@/generated/db/server_maintenance_allowed_player.queries";

/**
 * Custom queries for server_maintenance_allowed_player table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerMaintenanceAllowedPlayerQueries extends ServerMaintenanceAllowedPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerMaintenanceAllowedPlayer[]> {
  //   const result = await this.db.query<ServerMaintenanceAllowedPlayer>(
  //     `SELECT * FROM server_maintenance_allowed_player WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
