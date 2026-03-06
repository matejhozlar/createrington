import type { Pool, PoolClient } from "pg";
import { AdminBaseQueries } from "@/generated/db/admin.queries";

/**
 * Custom queries for admin table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class AdminQueries extends AdminBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<Admin[]> {
  //   const result = await this.db.query<Admin>(
  //     `SELECT * FROM admin WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
