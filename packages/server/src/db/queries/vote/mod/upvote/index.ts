import type { Pool, PoolClient } from "pg";
import { VoteModUpvoteBaseQueries } from "@/generated/db/vote_mod_upvote.queries";

/**
 * Custom queries for vote_mod_upvote table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteModUpvoteQueries extends VoteModUpvoteBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VoteModUpvote[]> {
  //   const result = await this.db.query<VoteModUpvote>(
  //     `SELECT * FROM vote_mod_upvote WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
