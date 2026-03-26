import type { Pool, PoolClient } from "pg";
import { StructurePackRotationBaseQueries } from "@/generated/db/structure_pack_rotation.queries";

/**
 * Custom queries for structure_pack_rotation table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class StructurePackRotationQueries extends StructurePackRotationBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<StructurePackRotation[]> {
  //   const result = await this.db.query<StructurePackRotation>(
  //     `SELECT * FROM structure_pack_rotation WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
