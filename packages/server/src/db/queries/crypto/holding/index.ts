import type { Pool, PoolClient } from "pg";
import { CryptoHoldingBaseQueries } from "@/generated/db/crypto_holding.queries";

/**
 * Custom queries for crypto_holding table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoHoldingQueries extends CryptoHoldingBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoHolding[]> {
  //   const result = await this.db.query<CryptoHolding>(
  //     `SELECT * FROM crypto_holding WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
