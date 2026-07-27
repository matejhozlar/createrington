import type { Pool, PoolClient } from "pg";
import { VoteModBaseQueries } from "@/generated/db/vote_mod.queries";

/**
 * Custom queries for vote_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteModQueries extends VoteModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VoteMod[]> {
  //   const result = await this.db.query<VoteMod>(
  //     `SELECT * FROM vote_mod WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
