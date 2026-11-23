import type { Pool, PoolClient } from "pg";
import { ServerMaintenanceAllowedPlayerBaseQueries } from "@/generated/db/server_maintenance_allowed_player.queries";

export class ServerMaintenanceAllowedPlayerQueries extends ServerMaintenanceAllowedPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
