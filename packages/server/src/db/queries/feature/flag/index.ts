import type { Pool, PoolClient } from "pg";
import { FeatureFlagBaseQueries } from "@/generated/db/feature_flag.queries";

/**
 * Custom queries for feature_flag table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class FeatureFlagQueries extends FeatureFlagBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<FeatureFlag[]> {
  //   const result = await this.db.query<FeatureFlag>(
  //     `SELECT * FROM feature_flag WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
