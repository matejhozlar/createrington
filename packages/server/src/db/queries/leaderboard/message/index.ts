import type { Pool, PoolClient } from "pg";
import { LeaderboardMessageBaseQueries } from "@/generated/db/leaderboard_message.queries";

/**
 * Custom queries for leaderboard_message table
 *
 * Extends the auto-generated base class with custom methods
 */
export class LeaderboardMessageQueries extends LeaderboardMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
