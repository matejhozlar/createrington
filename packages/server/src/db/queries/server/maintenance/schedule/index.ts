import type { Pool, PoolClient } from "pg";
import { ServerMaintenanceScheduleBaseQueries } from "@/generated/db/server_maintenance_schedule.queries";

/**
 * Custom queries for server_maintenance_schedule table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerMaintenanceScheduleQueries extends ServerMaintenanceScheduleBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerMaintenanceSchedule[]> {
  //   const result = await this.db.query<ServerMaintenanceSchedule>(
  //     `SELECT * FROM server_maintenance_schedule WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
