import type { Pool, PoolClient } from "pg";
import { ModpackModBaseQueries } from "@/generated/db/modpack_mod.queries";

/**
 * Custom queries for modpack_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackModQueries extends ModpackModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ModpackMod[]> {
  //   const result = await this.db.query<ModpackMod>(
  //     `SELECT * FROM modpack_mod WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
