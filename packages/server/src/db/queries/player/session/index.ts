import type { Pool, PoolClient } from "pg";
import { PlayerSessionBaseQueries } from "@/generated/db/player_session.queries";

/**
 * Custom queries for player_session table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerSessionQueries extends PlayerSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here

  /**
   * Get active session for a specific player
   */
}
