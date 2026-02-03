import { Pool, type PoolClient } from "pg";
import { PlayerBaseQueries } from "@/generated/db/player.queries";

/**
 * Custom queries for player table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerQueries extends PlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
