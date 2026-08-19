import type { Pool, PoolClient } from "pg";
import { AppSettingBaseQueries } from "@/generated/db/app_setting.queries";

/**
 * Custom queries for app_setting table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class AppSettingQueries extends AppSettingBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<AppSetting[]> {
  //   const result = await this.db.query<AppSetting>(
  //     `SELECT * FROM app_setting WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
