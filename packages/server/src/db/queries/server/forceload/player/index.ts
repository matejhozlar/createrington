import type { Pool, PoolClient } from "pg";
import { ServerForceloadPlayerBaseQueries } from "@/generated/db/server_forceload_player.queries";

export class ServerForceloadPlayerQueries extends ServerForceloadPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
