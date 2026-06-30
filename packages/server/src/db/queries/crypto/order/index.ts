import type { Pool, PoolClient } from "pg";
import { CryptoOrderBaseQueries } from "@/generated/db/crypto_order.queries";
import type { CryptoOrder } from "@createrington/shared/db/crypto_order.types";

/**
 * Custom queries for crypto_order table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoOrderQueries extends CryptoOrderBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Locks an order row FOR UPDATE and returns it (or null if it does not exist).
   * Must be called inside a transaction so the lock serializes fill, cancel, and
   * expire against each other for the same order.
   */
  async lockForUpdate(id: number): Promise<CryptoOrder | null> {
    const rows = await this.raw(
      "SELECT * FROM crypto_order WHERE id = $1 FOR UPDATE",
      [id],
    );
    return rows[0] ?? null;
  }
}
