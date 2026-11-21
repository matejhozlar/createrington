import type { Pool, PoolClient } from "pg";
import type { Donation, DonationRow } from "@createrington/shared/db";
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
    const result = await this.runQuery<DonationRow>(
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
      total_raised_cents: number;
      donor_count: number;
      donation_count: number;
    }>(
      "aggregate donation stats",
      `SELECT COALESCE(SUM(amount_cents), 0)::float8 AS total_raised_cents,
        COUNT(DISTINCT player_discord_id)::int AS donor_count,
        COUNT(*)::int AS donation_count
      FROM ${this.table}
      WHERE status = 'completed'`,
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}
