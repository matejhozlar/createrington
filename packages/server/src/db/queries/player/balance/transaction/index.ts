import type { Pool, PoolClient } from "pg";
import { PlayerBalanceTransactionBaseQueries } from "@/generated/db/player_balance_transaction.queries";

/**
 * Custom queries for player_balance_transaction table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerBalanceTransactionQueries extends PlayerBalanceTransactionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
