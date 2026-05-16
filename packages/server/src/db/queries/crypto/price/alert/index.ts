import type { Pool, PoolClient } from "pg";
import { CryptoPriceAlertBaseQueries } from "@/generated/db/crypto_price_alert.queries";

/**
 * Queries for the crypto_price_alert table
 *
 * Stores player-configured price alerts for individual tokens:
 * - Target price and direction (above/below) to determine when to fire
 * - Triggered flag and timestamp set once the condition is met
 * - Scoped per player and token with a unique constraint preventing duplicates
 *
 * NOTE: Inherits all generated CRUD operations from CryptoPriceAlertBaseQueries.
 * Add custom query methods directly to this class; this file is never overwritten by codegen.
 */
export class CryptoPriceAlertQueries extends CryptoPriceAlertBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
