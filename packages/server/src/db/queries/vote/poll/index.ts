import type { Pool, PoolClient } from "pg";
import { VotePollBaseQueries } from "@/generated/db/vote_poll.queries";

/**
 * Custom queries for vote_poll table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VotePollQueries extends VotePollBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VotePoll[]> {
  //   const result = await this.db.query<VotePoll>(
  //     `SELECT * FROM vote_poll WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
