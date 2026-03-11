import type { Pool, PoolClient } from "pg";
import { CryptoPriceSnapshotBaseQueries } from "@/generated/db/crypto_price_snapshot.queries";

/**
 * Custom queries for crypto_price_snapshot table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoPriceSnapshotQueries extends CryptoPriceSnapshotBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoPriceSnapshot[]> {
  //   const result = await this.db.query<CryptoPriceSnapshot>(
  //     `SELECT * FROM crypto_price_snapshot WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
