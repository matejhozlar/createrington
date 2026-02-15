import type { Pool, PoolClient } from "pg";
import { LotteryParticipantBaseQueries } from "@/generated/db/lottery_participant.queries";

/**
 * Custom queries for lottery_participant table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class LotteryParticipantQueries extends LotteryParticipantBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<LotteryParticipant[]> {
  //   const result = await this.db.query<LotteryParticipant>(
  //     `SELECT * FROM lottery_participant WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
