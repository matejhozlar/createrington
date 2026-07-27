import type { Pool, PoolClient } from "pg";
import { VoteBaseQueries } from "@/generated/db/vote.queries";

/**
 * Custom queries for vote table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteQueries extends VoteBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<Vote[]> {
  //   const result = await this.db.query<Vote>(
  //     `SELECT * FROM vote WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
