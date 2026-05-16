import type { Pool, PoolClient } from "pg";
import { CryptoSettingBaseQueries } from "@/generated/db/crypto_setting.queries";

/**
 * Custom queries for crypto_setting table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoSettingQueries extends CryptoSettingBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CryptoSetting[]> {
  //   const result = await this.db.query<CryptoSetting>(
  //     `SELECT * FROM crypto_setting WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
