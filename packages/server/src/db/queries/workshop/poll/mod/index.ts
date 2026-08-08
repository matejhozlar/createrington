import type { Pool, PoolClient } from "pg";
import { WorkshopPollModBaseQueries } from "@/generated/db/workshop_poll_mod.queries";

/**
 * Custom queries for workshop_poll_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopPollModQueries extends WorkshopPollModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopPollMod[]> {
  //   const result = await this.db.query<WorkshopPollMod>(
  //     `SELECT * FROM workshop_poll_mod WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
