import type { Pool, PoolClient } from "pg";
import { FeatureFlagBaseQueries } from "@/generated/db/feature_flag.queries";

export class FeatureFlagQueries extends FeatureFlagBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
