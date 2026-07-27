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

  /** Upvote counts per vote_mod id, missing ids mean zero. */
  async countGroupedByMod(
    voteModIds: number[],
  ): Promise<Record<number, number>> {
    if (voteModIds.length === 0) return {};

    const query = `
      SELECT vote_mod_id, COUNT(*)::int AS upvote_count
      FROM ${this.table}
      WHERE vote_mod_id = ANY($1)
      GROUP BY vote_mod_id`;
    const result = await this.runQuery<{
      vote_mod_id: number;
      upvote_count: number;
    }>("count upvotes grouped by mod", query, [voteModIds]);

    const counts: Record<number, number> = {};
    for (const row of result.rows) {
      counts[row.vote_mod_id] = row.upvote_count;
    }
    return counts;
  }
}
