import type { Pool, PoolClient } from "pg";
import { VotePollBallotBaseQueries } from "@/generated/db/vote_poll_ballot.queries";

/**
 * Custom queries for vote_poll_ballot table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VotePollBallotQueries extends VotePollBallotBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VotePollBallot[]> {
  //   const result = await this.db.query<VotePollBallot>(
  //     `SELECT * FROM vote_poll_ballot WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
