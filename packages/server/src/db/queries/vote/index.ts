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

  /** Distinct discord ids of everyone who suggested or upvoted in a vote. */
  async participantDiscordIds(voteId: number): Promise<string[]> {
    const query = `
      SELECT submitted_by AS discord_id
      FROM vote_mod
      WHERE vote_id = $1 AND source = 'user'
      UNION
      SELECT vmu.discord_id
      FROM vote_mod_upvote vmu
      JOIN vote_mod vm ON vm.id = vmu.vote_mod_id
      WHERE vm.vote_id = $1`;
    const result = await this.runQuery<{ discord_id: string }>(
      "vote participant discord ids",
      query,
      [voteId],
    );
    return result.rows.map((row) => row.discord_id);
  }
}
