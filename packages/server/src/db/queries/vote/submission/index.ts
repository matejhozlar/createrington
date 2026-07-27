import type { Pool, PoolClient } from "pg";
import { VoteSubmissionBaseQueries } from "@/generated/db/vote_submission.queries";

/**
 * Custom queries for vote_submission table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteSubmissionQueries extends VoteSubmissionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VoteSubmission[]> {
  //   const result = await this.db.query<VoteSubmission>(
  //     `SELECT * FROM vote_submission WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
