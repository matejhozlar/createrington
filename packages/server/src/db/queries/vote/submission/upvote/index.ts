import type { Pool, PoolClient } from "pg";
import { VoteSubmissionUpvoteBaseQueries } from "@/generated/db/vote_submission_upvote.queries";

/**
 * Custom queries for vote_submission_upvote table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteSubmissionUpvoteQueries extends VoteSubmissionUpvoteBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VoteSubmissionUpvote[]> {
  //   const result = await this.db.query<VoteSubmissionUpvote>(
  //     `SELECT * FROM vote_submission_upvote WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
