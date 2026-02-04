import type { Pool, PoolClient } from "pg";
import { ServerBaseQueries } from "@/generated/db/server.queries";

/**
 * Custom queries for server table
 *
 * Extends the auto-generated base class with custom methods
 */
export class ServerQueries extends ServerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
