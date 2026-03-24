import { Q } from "@/db";
import type { Donation, DonationCreate } from "@createrington/shared/db";

export class DonationRepository {
  async create(data: DonationCreate): Promise<Donation> {
    return Q.donation.createAndReturn(data);
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

  async count(): Promise<number> {
    const all = await Q.donation.findAll({});
    return all.length;
  }

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
