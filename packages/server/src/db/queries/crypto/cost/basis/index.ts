import type { Pool, PoolClient } from "pg";
import { CryptoCostBasisBaseQueries } from "@/generated/db/crypto_cost_basis.queries";

/**
 * Custom queries for crypto_cost_basis table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoCostBasisQueries extends CryptoCostBasisBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoCostBasis[]> {
  //   const result = await this.db.query<CryptoCostBasis>(
  //     `SELECT * FROM crypto_cost_basis WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
