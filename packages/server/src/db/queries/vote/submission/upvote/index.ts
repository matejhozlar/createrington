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

  /** Upvote counts per submission id, missing ids mean zero. */
  async countGroupedBySubmission(
    submissionIds: number[],
  ): Promise<Record<number, number>> {
    if (submissionIds.length === 0) return {};

    const query = `
      SELECT submission_id, COUNT(*)::int AS upvote_count
      FROM ${this.table}
      WHERE submission_id = ANY($1)
      GROUP BY submission_id`;
    const result = await this.runQuery<{
      submission_id: number;
      upvote_count: number;
    }>("count upvotes grouped by submission", query, [submissionIds]);

    const counts: Record<number, number> = {};
    for (const row of result.rows) {
      counts[row.submission_id] = row.upvote_count;
    }
    return counts;
  }
}
