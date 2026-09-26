import { Q } from "@/db";
import type { Donation, DonationCreate } from "@createrington/shared/db";

/**
 * Read/write access to the donation ledger. Wraps Q.donation for one-off
 * donations and Stripe-backed monthly subscriptions, and aggregates
 * fundraising totals across completed entries.
 */
export class DonationRepository {
  /** Persist a new donation row (Stripe webhook entry point). */
  async create(data: DonationCreate): Promise<Donation> {
    return Q.donation.createAndReturn(data);
  }

  /** All donations for a Discord user, newest first. */
  async findByDiscordId(discordId: string): Promise<Donation[]> {
    return Q.donation.findAll(
      { playerDiscordId: discordId },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
  }

  /** Look up a donation by its Stripe checkout session ID, or null. */
  async findBySessionId(stripeSessionId: string): Promise<Donation | null> {
    return Q.donation.find({ stripeSessionId });
  }

  /** Most recent completed monthly donation with a Stripe subscription ID, or null. */
  async findActiveSubscription(discordId: string): Promise<Donation | null> {
    const donations = await Q.donation.findAll(
      {
        playerDiscordId: discordId,
        type: "monthly",
        status: "completed",
      },
      { orderBy: "createdAt", orderDirection: "desc" },
    );

    return donations.find((d) => d.stripeSubscriptionId != null) ?? null;
  }

  /** All completed monthly donations with a Stripe subscription ID. */
  async findAllSubscriptions(): Promise<Donation[]> {
    return Q.donation.findAll(
      {
        type: "monthly",
        status: "completed",
        stripeSubscriptionId: { $exists: true },
      },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
  }

  /** Fundraising totals across completed donations (cents, unique donors, count). */
  async getStats(): Promise<{
    totalRaisedCents: number;
    donorCount: number;
    donationCount: number;
  }> {
    return Q.donation.getCompletedStats();
  }
}
