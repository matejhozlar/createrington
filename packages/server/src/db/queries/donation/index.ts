import type { Pool, PoolClient } from "pg";
import type { Donation } from "@createrington/shared/db";
import { DonationBaseQueries } from "@/generated/db/donation.queries";

export class DonationQueries extends DonationBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** The newest completed monthly donation with a Stripe subscription ID, or null. */
  async findActiveSubscription(discordId: string): Promise<Donation | null> {
    const [donation] = await this.findAll(
      {
        playerDiscordId: discordId,
        type: "monthly",
        status: "completed",
        stripeSubscriptionId: { $exists: true },
      },
      { orderBy: "createdAt", orderDirection: "desc", limit: 1 },
    );

    return donation ?? null;
  }

  /** The newest completed monthly donation of every Stripe subscription. */
  async getLatestPerSubscription(): Promise<Donation[]> {
    const result = await this.runQuery(
      "get latest donation per subscription",
      `SELECT DISTINCT ON (stripe_subscription_id) *
       FROM ${this.table}
       WHERE type = 'monthly'
         AND status = 'completed'
         AND stripe_subscription_id IS NOT NULL
       ORDER BY stripe_subscription_id, created_at DESC`,
    );
    return this.mapRowsToEntities(result.rows);
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
