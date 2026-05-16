import type { Pool, PoolClient } from "pg";
import { CryptoMarketEventBaseQueries } from "@/generated/db/crypto_market_event.queries";

/**
 * Queries for the crypto_market_event table
 *
 * Stores market news feed entries and system-generated events that affect
 * token prices or inform players of market conditions:
 * - Typed events (e.g., news, crash, rally) with optional token association
 * - Severity levels (info, warning, critical) for display prioritization
 * - Optional expiry via activeUntil for time-limited events
 * - Arbitrary metadata payload for event-specific details
 *
 * NOTE: Inherits all generated CRUD operations from CryptoMarketEventBaseQueries.
 * Add custom query methods directly to this class; this file is never overwritten by codegen.
 */
export class CryptoMarketEventQueries extends CryptoMarketEventBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
