import type { Pool, PoolClient } from "pg";
import { CryptoTokenBaseQueries } from "@/generated/db/crypto_token.queries";

/**
 * Custom queries for crypto_token table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoTokenQueries extends CryptoTokenBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoToken[]> {
  //   const result = await this.db.query<CryptoToken>(
  //     `SELECT * FROM crypto_token WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
