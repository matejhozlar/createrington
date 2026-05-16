import type { Pool, PoolClient } from "pg";
import { CryptoWatchlistBaseQueries } from "@/generated/db/crypto_watchlist.queries";

/**
 * Queries for the crypto_watchlist table
 *
 * Stores a player's personal token watchlist for quick market monitoring:
 * - Associates a player with one or more tokens they want to track
 * - Enforces a unique constraint per (player, token) pair
 * - Records creation timestamp for ordering and display purposes
 *
 * NOTE: Inherits all generated CRUD operations from CryptoWatchlistBaseQueries.
 * Add custom query methods directly to this class; this file is never overwritten by codegen.
 */
export class CryptoWatchlistQueries extends CryptoWatchlistBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
