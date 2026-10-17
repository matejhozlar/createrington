import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import type { Client } from "discord.js";

const { donationRepo } = vi.hoisted(() => ({
  donationRepo: {
    findBySessionId: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    stripe: { secretKey: "sk_test_unit" },
    discord: { guild: { id: "guild-1" } },
  },
}));

vi.mock("@/db", () => ({ donationRepo }));

vi.mock("@/discord/constants/roles", () => ({
  DiscordRolesNamespace: { SUPPORTER: "supporter-role" },
}));

vi.mock("@/discord/utils/roles/role-manager", () => ({
  RoleManager: { assign: vi.fn() },
}));

import { DonationService } from "@/services/donation/donation.service";
import { UniqueViolationError } from "@/db/utils";

const SESSION = {
  id: "cs_test_1",
  metadata: { discordId: "user-1", type: "one_time", amountCents: "500" },
  customer: null,
  subscription: null,
} as unknown as Stripe.Checkout.Session;

function service() {
  const getGuild = vi.fn().mockReturnValue(undefined);
  const client = { guilds: { cache: { get: getGuild } } } as unknown as Client;
  return { donations: new DonationService(client), getGuild };
}

describe("DonationService.handleSessionCompleted", () => {
  beforeEach(() => {
    donationRepo.findBySessionId.mockReset().mockResolvedValue(null);
    donationRepo.create.mockReset();
  });

  it("records the donation and grants the supporter role", async () => {
    donationRepo.create.mockResolvedValue({ amountCents: 500 });
    const { donations, getGuild } = service();

    await donations.handleSessionCompleted(SESSION);

    expect(donationRepo.create).toHaveBeenCalledOnce();
    expect(getGuild).toHaveBeenCalledWith("guild-1");
  });

  it("treats a concurrent duplicate insert as a replay", async () => {
    donationRepo.create.mockRejectedValue(
      new UniqueViolationError(
        "duplicate key",
        "donation_stripe_session_id_unique",
      ),
    );
    const { donations, getGuild } = service();

    await expect(
      donations.handleSessionCompleted(SESSION),
    ).resolves.toBeUndefined();
    expect(getGuild).not.toHaveBeenCalled();
  });

  it("rethrows any other unique violation", async () => {
    donationRepo.create.mockRejectedValue(
      new UniqueViolationError("duplicate key", "some_other_unique"),
    );
    const { donations } = service();

    await expect(donations.handleSessionCompleted(SESSION)).rejects.toThrow(
      UniqueViolationError,
    );
  });
});
