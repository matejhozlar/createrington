import type { Pool, PoolClient } from "pg";
import { ServerMaintenanceSettingBaseQueries } from "@/generated/db/server_maintenance_setting.queries";

export class ServerMaintenanceSettingQueries extends ServerMaintenanceSettingBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
