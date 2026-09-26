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

  async getCompletedStats(): Promise<{
    totalRaisedCents: number;
    donorCount: number;
    donationCount: number;
  }> {
    const result = await this.runQuery<{
      total_raised_cents: string;
      donor_count: number;
      donation_count: number;
    }>(
      "aggregate donation stats",
      `SELECT COALESCE(SUM(amount_cents), 0) AS total_raised_cents,
        COUNT(DISTINCT player_discord_id)::integer AS donor_count,
        COUNT(*)::integer AS donation_count
      FROM donation
      WHERE status = 'completed'`,
    );
    const row = result.rows[0];
    return {
      totalRaisedCents: Number(row.total_raised_cents),
      donorCount: row.donor_count,
      donationCount: row.donation_count,
    };
  }
}
