import type { Pool, PoolClient } from "pg";
import { CryptoPortfolioSnapshotBaseQueries } from "@/generated/db/crypto_portfolio_snapshot.queries";

/**
 * Queries for the crypto_portfolio_snapshot table
 *
 * Stores daily point-in-time snapshots of a player's portfolio valuation:
 * - Total portfolio value and total amount invested at snapshot time
 * - Realized and unrealized PnL for performance tracking over time
 * - Indexed by player and recorded_at descending for efficient history queries
 *
 * NOTE: Inherits all generated CRUD operations from CryptoPortfolioSnapshotBaseQueries.
 * Add custom query methods directly to this class — this file is never overwritten by codegen.
 */
export class CryptoPortfolioSnapshotQueries extends CryptoPortfolioSnapshotBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
