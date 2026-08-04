import type { Pool, PoolClient } from "pg";
import { ModpackBaseQueries } from "@/generated/db/modpack.queries";

/**
 * Custom queries for modpack table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackQueries extends ModpackBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<Modpack[]> {
  //   const result = await this.db.query<Modpack>(
  //     `SELECT * FROM modpack WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
