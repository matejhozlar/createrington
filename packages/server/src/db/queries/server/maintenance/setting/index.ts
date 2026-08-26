import type { Pool, PoolClient } from "pg";
import { ServerMaintenanceSettingBaseQueries } from "@/generated/db/server_maintenance_setting.queries";

/**
 * Custom queries for server_maintenance_setting table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerMaintenanceSettingQueries extends ServerMaintenanceSettingBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerMaintenanceSetting[]> {
  //   const result = await this.db.query<ServerMaintenanceSetting>(
  //     `SELECT * FROM server_maintenance_setting WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
