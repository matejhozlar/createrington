import type { Pool, PoolClient } from "pg";
import { DonationBaseQueries } from "@/generated/db/donation.queries";

/**
 * Custom queries for donation table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DonationQueries extends DonationBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
