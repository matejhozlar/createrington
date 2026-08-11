import type { Pool, PoolClient } from "pg";
import { WorkshopModEventBaseQueries } from "@/generated/db/workshop_mod_event.queries";

/**
 * Custom queries for workshop_mod_event table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopModEventQueries extends WorkshopModEventBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopModEvent[]> {
  //   const result = await this.db.query<WorkshopModEvent>(
  //     `SELECT * FROM workshop_mod_event WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
