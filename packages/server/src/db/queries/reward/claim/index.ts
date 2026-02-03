import { Pool, type PoolClient } from "pg";
import { RewardClaimBaseQueries } from "@/generated/db/reward_claim.queries";

/**
 * Custom queries for reward_claim table
 *
 * Extends the auto-generated base class with custom methods
 */
export class RewardClaimQueries extends RewardClaimBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
