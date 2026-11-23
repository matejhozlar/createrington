import type { Pool, PoolClient } from "pg";
import { ServerMaintenanceScheduleBaseQueries } from "@/generated/db/server_maintenance_schedule.queries";

export class ServerMaintenanceScheduleQueries extends ServerMaintenanceScheduleBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
