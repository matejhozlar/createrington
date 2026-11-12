import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";
import type { Client } from "discord.js";

const { donationRepo } = vi.hoisted(() => ({
  donationRepo: {
    findBySessionId: vi.fn(),
    create: vi.fn(),
    markSupporterRoleGranted: vi.fn(),
    findActiveSubscription: vi.fn(),
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
import { RoleManager } from "@/discord/utils/roles/role-manager";

const SESSION = {
  id: "cs_test_1",
  metadata: { discordId: "user-1", type: "one_time", amountCents: "500" },
  customer: null,
  subscription: null,
} as unknown as Stripe.Checkout.Session;

function service(guild?: unknown) {
  const getGuild = vi.fn().mockReturnValue(guild);
  const client = { guilds: { cache: { get: getGuild } } } as unknown as Client;
  return { donations: new DonationService(client), getGuild };
}

const GUILD = {
  members: { fetch: vi.fn().mockResolvedValue({ id: "user-1" }) },
};

describe("DonationService.handleSessionCompleted", () => {
  beforeEach(() => {
    donationRepo.findBySessionId.mockReset().mockResolvedValue(null);
    donationRepo.create.mockReset();
    donationRepo.markSupporterRoleGranted.mockReset();
    vi.mocked(RoleManager.assign).mockReset();
  });

  it("records the donation and marks the supporter role once it is granted", async () => {
    donationRepo.create.mockResolvedValue({ id: 7, amountCents: 500 });
    vi.mocked(RoleManager.assign).mockResolvedValue(true);
    const { donations } = service(GUILD);

    await donations.handleSessionCompleted(SESSION);

    expect(donationRepo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ supporterRoleGranted: true }),
    );
    expect(donationRepo.markSupporterRoleGranted).toHaveBeenCalledWith(7);
  });

  it("leaves the supporter role unmarked when the grant fails", async () => {
    donationRepo.create.mockResolvedValue({ id: 7, amountCents: 500 });
    vi.mocked(RoleManager.assign).mockResolvedValue(false);
    const { donations } = service(GUILD);

    await donations.handleSessionCompleted(SESSION);

    expect(donationRepo.create).toHaveBeenCalledOnce();
    expect(donationRepo.markSupporterRoleGranted).not.toHaveBeenCalled();
  });

  it("leaves the supporter role unmarked when the guild is unavailable", async () => {
    donationRepo.create.mockResolvedValue({ id: 7, amountCents: 500 });
    const { donations, getGuild } = service();

    await donations.handleSessionCompleted(SESSION);

    expect(getGuild).toHaveBeenCalledWith("guild-1");
    expect(donationRepo.markSupporterRoleGranted).not.toHaveBeenCalled();
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

describe("DonationService.getActiveSubscription", () => {
  function withRetrieve(retrieve: ReturnType<typeof vi.fn>) {
    const { donations } = service();
    (
      donations as unknown as {
        stripe: { subscriptions: { retrieve: typeof retrieve } };
      }
    ).stripe = { subscriptions: { retrieve } };
    return donations;
  }

  beforeEach(() => {
    donationRepo.findActiveSubscription
      .mockReset()
      .mockResolvedValue({ stripeSubscriptionId: "sub_1", amountCents: 500 });
  });

  it("returns null when Stripe no longer knows the subscription", async () => {
    const donations = withRetrieve(
      vi.fn().mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such subscription",
        }),
      ),
    );

    await expect(donations.getActiveSubscription("user-1")).resolves.toBeNull();
  });

  it("throws when Stripe cannot be reached", async () => {
    const donations = withRetrieve(
      vi.fn().mockRejectedValue(
        new Stripe.errors.StripeConnectionError({
          type: "api_error",
          message: "connect ECONNREFUSED",
        }),
      ),
    );

    await expect(donations.getActiveSubscription("user-1")).rejects.toThrow(
      "ECONNREFUSED",
    );
  });
});
