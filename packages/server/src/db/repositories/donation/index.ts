import { Q } from "@/db";
import type { Donation, DonationCreate } from "@createrington/shared/db";

export class DonationRepository {
  async create(data: DonationCreate): Promise<Donation> {
    return Q.donation.createAndReturn(data);
  }

  async completeBySessionId(
    stripeSessionId: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
  ): Promise<Donation | null> {
    const donation = await Q.donation.find({ stripeSessionId });
    if (!donation) return null;

    await Q.donation.update(
      { stripeSessionId },
      {
        status: "completed",
        completedAt: new Date(),
        supporterRoleGranted: true,
        ...(stripeCustomerId && { stripeCustomerId }),
        ...(stripeSubscriptionId && { stripeSubscriptionId }),
      },
    );

    return Q.donation.find({ stripeSessionId });
  }

  async findByDiscordId(discordId: string): Promise<Donation[]> {
    return Q.donation.findAll(
      { playerDiscordId: discordId },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
  }

  async findBySessionId(stripeSessionId: string): Promise<Donation | null> {
    return Q.donation.find({ stripeSessionId });
  }

  async listAll(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<Donation[]> {
    return Q.donation.findAll(
      {},
      {
        orderBy: "createdAt",
        orderDirection: "desc",
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
      },
    );
  }

  async getStats(): Promise<{
    totalRaisedCents: number;
    donorCount: number;
    donationCount: number;
  }> {
    const completed = await Q.donation.findAll({ status: "completed" });

    const uniqueDonors = new Set(completed.map((d) => d.playerDiscordId));
    const totalRaisedCents = completed.reduce(
      (sum, d) => sum + d.amountCents,
      0,
    );

    return {
      totalRaisedCents,
      donorCount: uniqueDonors.size,
      donationCount: completed.length,
    };
  }
}
