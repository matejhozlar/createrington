import type { Pool, PoolClient } from "pg";
import { StructurePackModBaseQueries } from "@/generated/db/structure_pack_mod.queries";

/**
 * Custom queries for structure_pack_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class StructurePackModQueries extends StructurePackModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<StructurePackMod[]> {
  //   const result = await this.db.query<StructurePackMod>(
  //     `SELECT * FROM structure_pack_mod WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
