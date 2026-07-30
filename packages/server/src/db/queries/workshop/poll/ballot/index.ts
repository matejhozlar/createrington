import type { Pool, PoolClient } from "pg";
import { WorkshopPollBallotBaseQueries } from "@/generated/db/workshop_poll_ballot.queries";

/**
 * Custom queries for workshop_poll_ballot table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopPollBallotQueries extends WorkshopPollBallotBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopPollBallot[]> {
  //   const result = await this.db.query<WorkshopPollBallot>(
  //     `SELECT * FROM workshop_poll_ballot WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
