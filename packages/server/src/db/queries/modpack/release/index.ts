import type { Pool, PoolClient } from "pg";
import { ModpackReleaseBaseQueries } from "@/generated/db/modpack_release.queries";

/**
 * Custom queries for modpack_release table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackReleaseQueries extends ModpackReleaseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ModpackRelease[]> {
  //   const result = await this.db.query<ModpackRelease>(
  //     `SELECT * FROM modpack_release WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
