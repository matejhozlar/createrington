import type { Pool, PoolClient } from "pg";
import { AdminBaseQueries } from "@/generated/db/admin.queries";

/**
 * Custom queries for admin table
 *
 * Extends the auto-generated base class with custom methods
 */
export class AdminQueries extends AdminBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
