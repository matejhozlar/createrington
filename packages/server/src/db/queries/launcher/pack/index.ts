import type { Pool, PoolClient } from "pg";
import { LauncherPackBaseQueries } from "@/generated/db/launcher_pack.queries";

/**
 * Custom queries for launcher_pack table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class LauncherPackQueries extends LauncherPackBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<LauncherPack[]> {
  //   const result = await this.db.query<LauncherPack>(
  //     `SELECT * FROM launcher_pack WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
