import type { Pool, PoolClient } from "pg";
import { LauncherReleaseBaseQueries } from "@/generated/db/launcher_release.queries";

/**
 * Custom queries for launcher_release table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class LauncherReleaseQueries extends LauncherReleaseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<LauncherRelease[]> {
  //   const result = await this.db.query<LauncherRelease>(
  //     `SELECT * FROM launcher_release WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
