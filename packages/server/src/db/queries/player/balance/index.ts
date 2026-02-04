import type { Pool, PoolClient } from "pg";
import { PlayerBalanceBaseQueries } from "@/generated/db/player_balance.queries";

/**
 * Custom queries for player_balance table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerBalanceQueries extends PlayerBalanceBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
