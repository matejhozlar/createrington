import type { Pool, PoolClient } from "pg";
import { WorkshopPollBaseQueries } from "@/generated/db/workshop_poll.queries";

/**
 * Custom queries for workshop_poll table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopPollQueries extends WorkshopPollBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopPoll[]> {
  //   const result = await this.db.query<WorkshopPoll>(
  //     `SELECT * FROM workshop_poll WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
