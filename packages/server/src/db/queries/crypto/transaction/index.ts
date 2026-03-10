import type { Pool, PoolClient } from "pg";
import { CryptoTransactionBaseQueries } from "@/generated/db/crypto_transaction.queries";

/**
 * Custom queries for crypto_transaction table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoTransactionQueries extends CryptoTransactionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoTransaction[]> {
  //   const result = await this.db.query<CryptoTransaction>(
  //     `SELECT * FROM crypto_transaction WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
