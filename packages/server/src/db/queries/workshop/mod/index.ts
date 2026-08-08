import type { Pool, PoolClient } from "pg";
import { WorkshopModBaseQueries } from "@/generated/db/workshop_mod.queries";

/**
 * Custom queries for workshop_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopModQueries extends WorkshopModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopMod[]> {
  //   const result = await this.db.query<WorkshopMod>(
  //     `SELECT * FROM workshop_mod WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
