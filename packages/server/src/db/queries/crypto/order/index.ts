import type { Pool, PoolClient } from "pg";
import { CryptoOrderBaseQueries } from "@/generated/db/crypto_order.queries";

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

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoOrder[]> {
  //   const result = await this.db.query<CryptoOrder>(
  //     `SELECT * FROM crypto_order WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
