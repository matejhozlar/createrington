import type { Pool, PoolClient } from "pg";
import { CryptoTreasuryBaseQueries } from "@/generated/db/crypto_treasury.queries";

/**
 * Custom queries for crypto_treasury table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoTreasuryQueries extends CryptoTreasuryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoTreasury[]> {
  //   const result = await this.db.query<CryptoTreasury>(
  //     `SELECT * FROM crypto_treasury WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
