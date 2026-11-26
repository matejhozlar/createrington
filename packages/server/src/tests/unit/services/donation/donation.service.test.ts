import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";
import type { Client, GuildMember } from "discord.js";

const { donation, messages } = vi.hoisted(() => ({
  messages: { send: vi.fn() },
  donation: {
    find: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    createAndReturn: vi.fn(),
    updateAll: vi.fn(),
    getLatestPerSubscription: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    stripe: { secretKey: "sk_test_unit" },
    discord: { guild: { id: "guild-1" } },
  },
}));

vi.mock("@/db", () => ({ Q: { donation } }));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "900" } },
    Roles: { ADMIN: "admin-role" },
    Messages: messages,
  },
}));

vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    error: (title: string, description?: string) => ({
      build: () => ({ title, description }),
    }),
  },
}));

vi.mock("@/discord/constants/roles", () => ({
  DiscordRolesNamespace: { SUPPORTER: "supporter-role" },
}));

vi.mock("@/discord/utils/roles/role-manager", () => ({
  RoleManager: { assign: vi.fn() },
}));

import { DonationService } from "@/services/donation/donation.service";
import { UniqueViolationError } from "@/db/utils";
import { ConflictError } from "@/errors";
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
    donation.find.mockReset().mockResolvedValue(null);
    donation.createAndReturn.mockReset();
    donation.updateAll.mockReset();
    vi.mocked(RoleManager.assign).mockReset();
  });

  it("records the donation and marks the supporter role once it is granted", async () => {
    donation.createAndReturn.mockResolvedValue({ id: 7, amountCents: 500 });
    vi.mocked(RoleManager.assign).mockResolvedValue(true);
    const { donations } = service(GUILD);

    await donations.handleSessionCompleted(SESSION);

    expect(donation.createAndReturn).toHaveBeenCalledWith(
      expect.not.objectContaining({ supporterRoleGranted: true }),
    );
    expect(donation.updateAll).toHaveBeenCalledWith(
      {
        playerDiscordId: "user-1",
        status: "completed",
        supporterRoleGranted: false,
      },
      { supporterRoleGranted: true },
    );
  });

  it("stores the first invoice of a monthly checkout", async () => {
    donation.createAndReturn.mockResolvedValue({ id: 7, amountCents: 500 });
    const { donations } = service();

    await donations.handleSessionCompleted({
      ...SESSION,
      customer: "cus_1",
      subscription: "sub_1",
      invoice: "in_first",
    } as Stripe.Checkout.Session);

    expect(donation.createAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeInvoiceId: "in_first",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      }),
    );
  });

  it("retries the supporter role on a replay of a session whose grant failed", async () => {
    donation.find.mockResolvedValue({ id: 7, supporterRoleGranted: false });
    vi.mocked(RoleManager.assign).mockResolvedValue(true);
    const { donations } = service(GUILD);

    await donations.handleSessionCompleted(SESSION);

    expect(donation.createAndReturn).not.toHaveBeenCalled();
    expect(donation.updateAll).toHaveBeenCalledWith(
      expect.objectContaining({ playerDiscordId: "user-1" }),
      { supporterRoleGranted: true },
    );
  });

  it("skips a replay whose supporter role was already granted", async () => {
    donation.find.mockResolvedValue({ id: 7, supporterRoleGranted: true });
    const { donations, getGuild } = service(GUILD);

    await donations.handleSessionCompleted(SESSION);

    expect(getGuild).not.toHaveBeenCalled();
    expect(donation.updateAll).not.toHaveBeenCalled();
  });

  it("leaves the supporter role unmarked when the grant fails", async () => {
    donation.createAndReturn.mockResolvedValue({ id: 7, amountCents: 500 });
    vi.mocked(RoleManager.assign).mockResolvedValue(false);
    const { donations } = service(GUILD);

    await donations.handleSessionCompleted(SESSION);

    expect(donation.createAndReturn).toHaveBeenCalledOnce();
    expect(donation.updateAll).not.toHaveBeenCalled();
  });

  it("leaves the supporter role unmarked when the guild is unavailable", async () => {
    donation.createAndReturn.mockResolvedValue({ id: 7, amountCents: 500 });
    const { donations, getGuild } = service();

    await donations.handleSessionCompleted(SESSION);

    expect(getGuild).toHaveBeenCalledWith("guild-1");
    expect(donation.updateAll).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate insert as a replay", async () => {
    donation.createAndReturn.mockRejectedValue(
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
    donation.createAndReturn.mockRejectedValue(
      new UniqueViolationError("duplicate key", "some_other_unique"),
    );
    const { donations } = service();

    await expect(donations.handleSessionCompleted(SESSION)).rejects.toThrow(
      UniqueViolationError,
    );
  });
});

function invoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: "in_2",
    billing_reason: "subscription_cycle",
    amount_paid: 500,
    currency: "eur",
    customer: "cus_1",
    parent: { subscription_details: { subscription: "sub_1" } },
    status_transitions: { paid_at: 1_800_000_000 },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

describe("DonationService.handleInvoicePaid", () => {
  const FIRST = {
    id: 7,
    playerDiscordId: "user-1",
    type: "monthly",
    stripeCustomerId: "cus_1",
    supporterRoleGranted: true,
  };

  beforeEach(() => {
    donation.find.mockReset().mockResolvedValue(null);
    donation.findAll.mockReset().mockResolvedValue([FIRST]);
    donation.createAndReturn.mockReset();
    donation.updateAll.mockReset();
    vi.mocked(RoleManager.assign).mockReset().mockResolvedValue(true);
  });

  it("records a renewal as its own donation of the subscription's donor", async () => {
    donation.createAndReturn.mockResolvedValue({
      id: 8,
      amountCents: 500,
      playerDiscordId: "user-1",
    });
    const { donations } = service(GUILD);

    await donations.handleInvoicePaid(invoice());

    expect(donation.find).toHaveBeenCalledWith({ stripeInvoiceId: "in_2" });
    expect(donation.findAll).toHaveBeenCalledWith(
      { stripeSubscriptionId: "sub_1" },
      { limit: 1, orderBy: "createdAt", orderDirection: "asc" },
    );
    expect(donation.createAndReturn).toHaveBeenCalledWith({
      playerDiscordId: "user-1",
      type: "monthly",
      amountCents: 500,
      currency: "eur",
      stripeInvoiceId: "in_2",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "completed",
      completedAt: new Date(1_800_000_000_000),
    });
    expect(donation.updateAll).toHaveBeenCalledWith(
      expect.objectContaining({ playerDiscordId: "user-1" }),
      { supporterRoleGranted: true },
    );
  });

  it.each([
    ["the first invoice", { billing_reason: "subscription_create" }],
    ["a free invoice", { amount_paid: 0 }],
    ["an invoice outside a subscription", { parent: null }],
  ])("ignores %s", async (_label, overrides) => {
    const { donations } = service(GUILD);

    await donations.handleInvoicePaid(invoice(overrides));

    expect(donation.find).not.toHaveBeenCalled();
    expect(donation.createAndReturn).not.toHaveBeenCalled();
  });

  it("skips an invoice of a subscription it never recorded", async () => {
    donation.findAll.mockResolvedValue([]);
    const { donations } = service(GUILD);

    await donations.handleInvoicePaid(invoice());

    expect(donation.createAndReturn).not.toHaveBeenCalled();
  });

  it("retries the supporter role on a replay of a renewal whose grant failed", async () => {
    donation.find.mockResolvedValue({ ...FIRST, supporterRoleGranted: false });
    const { donations } = service(GUILD);

    await donations.handleInvoicePaid(invoice());

    expect(donation.createAndReturn).not.toHaveBeenCalled();
    expect(donation.updateAll).toHaveBeenCalledOnce();
  });

  it("treats a concurrent duplicate insert as a replay", async () => {
    donation.createAndReturn.mockRejectedValue(
      new UniqueViolationError(
        "duplicate key",
        "donation_stripe_invoice_id_unique",
      ),
    );
    const { donations, getGuild } = service(GUILD);

    await expect(
      donations.handleInvoicePaid(invoice()),
    ).resolves.toBeUndefined();
    expect(getGuild).not.toHaveBeenCalled();
  });
});

describe("DonationService.restoreSupporterRole", () => {
  const MEMBER = { id: "user-1" } as unknown as GuildMember;

  beforeEach(() => {
    donation.count.mockReset();
    donation.updateAll.mockReset();
    vi.mocked(RoleManager.assign).mockReset().mockResolvedValue(true);
  });

  it("gives a returning donor the role and marks their donations", async () => {
    donation.count.mockResolvedValue(2);
    const { donations } = service();

    await donations.restoreSupporterRole(MEMBER);

    expect(donation.count).toHaveBeenCalledWith({
      playerDiscordId: "user-1",
      status: "completed",
    });
    expect(RoleManager.assign).toHaveBeenCalledWith(
      MEMBER,
      "supporter-role",
      "Donation supporter",
    );
    expect(donation.updateAll).toHaveBeenCalledOnce();
  });

  it("leaves a member who never donated alone", async () => {
    donation.count.mockResolvedValue(0);
    const { donations } = service();

    await donations.restoreSupporterRole(MEMBER);

    expect(RoleManager.assign).not.toHaveBeenCalled();
  });
});

type StripeStub = {
  subscriptions?: { retrieve?: unknown; update?: unknown; cancel?: unknown };
  checkout?: { sessions: { create: unknown } };
};

type StubSubscription = { status: string; cancel_at_period_end?: boolean };

function withStripe(stripe: StripeStub) {
  const { donations } = service();
  (donations as unknown as { stripe: StripeStub }).stripe = stripe;
  return donations;
}

function storedSubscriptions(...ids: string[]) {
  donation.getLatestPerSubscription.mockResolvedValue(
    ids.map((id, i) => ({ stripeSubscriptionId: id, amountCents: 500 + i })),
  );
}

function stripeSubscriptions(subs: Record<string, StubSubscription>) {
  return vi.fn(async (id: string) => {
    const sub = subs[id];
    if (!sub) {
      throw new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such subscription",
      });
    }
    return {
      id,
      cancel_at_period_end: false,
      cancel_at: null,
      billing_cycle_anchor: 1_700_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
      ...sub,
    };
  });
}

describe("DonationService.getActiveSubscription", () => {
  beforeEach(() => {
    donation.getLatestPerSubscription.mockReset();
    storedSubscriptions("sub_1");
  });

  it("looks up only the subscriptions of the player", async () => {
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({ sub_1: { status: "active" } }),
      },
    });

    await donations.getActiveSubscription("user-1");

    expect(donation.getLatestPerSubscription).toHaveBeenCalledWith("user-1");
  });

  it("reports the end of the current billing period as the renewal date", async () => {
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({ sub_1: { status: "active" } }),
      },
    });

    await expect(
      donations.getActiveSubscription("user-1"),
    ).resolves.toMatchObject({
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it("returns null when Stripe no longer knows the subscription", async () => {
    const donations = withStripe({
      subscriptions: { retrieve: stripeSubscriptions({}) },
    });

    await expect(donations.getActiveSubscription("user-1")).resolves.toBeNull();
  });

  it("throws when Stripe cannot be reached", async () => {
    const donations = withStripe({
      subscriptions: {
        retrieve: vi.fn().mockRejectedValue(
          new Stripe.errors.StripeConnectionError({
            type: "api_error",
            message: "connect ECONNREFUSED",
          }),
        ),
      },
    });

    await expect(donations.getActiveSubscription("user-1")).rejects.toThrow(
      "ECONNREFUSED",
    );
  });

  it("still shows an older live subscription once the newest one has ended", async () => {
    storedSubscriptions("sub_new", "sub_old");
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({
          sub_new: { status: "canceled" },
          sub_old: { status: "active" },
        }),
      },
    });

    await expect(
      donations.getActiveSubscription("user-1"),
    ).resolves.toMatchObject({ subscriptionId: "sub_old", amountCents: 501 });
  });

  it("prefers a renewing subscription over a newer one that is cancelling", async () => {
    storedSubscriptions("sub_new", "sub_old");
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({
          sub_new: { status: "active", cancel_at_period_end: true },
          sub_old: { status: "active" },
        }),
      },
    });

    await expect(
      donations.getActiveSubscription("user-1"),
    ).resolves.toMatchObject({
      subscriptionId: "sub_old",
      cancelAtPeriodEnd: false,
    });
  });

  it("returns null when every subscription has ended", async () => {
    storedSubscriptions("sub_a", "sub_b");
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({
          sub_a: { status: "canceled" },
          sub_b: { status: "incomplete_expired" },
        }),
      },
    });

    await expect(donations.getActiveSubscription("user-1")).resolves.toBeNull();
  });
});

describe("DonationService.cancelSubscription", () => {
  beforeEach(() => {
    donation.getLatestPerSubscription.mockReset();
  });

  it("cancels the subscription that is still renewing", async () => {
    storedSubscriptions("sub_new", "sub_old");
    const update = vi.fn(async (id: string) => ({
      id,
      cancel_at: 1_800_000_000,
    }));
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({
          sub_new: { status: "canceled" },
          sub_old: { status: "active" },
        }),
        update,
      },
    });

    await donations.cancelSubscription("user-1");

    expect(update).toHaveBeenCalledWith("sub_old", {
      cancel_at_period_end: true,
    });
  });
});

describe("DonationService.cancelAllSubscriptions", () => {
  beforeEach(() => {
    donation.getLatestPerSubscription.mockReset();
    messages.send.mockReset().mockResolvedValue(undefined);
  });

  it("cancels every live subscription of the player immediately", async () => {
    storedSubscriptions("sub_a", "sub_b", "sub_ended", "sub_gone");
    const cancel = vi.fn().mockResolvedValue({});
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({
          sub_a: { status: "active" },
          sub_b: { status: "past_due", cancel_at_period_end: true },
          sub_ended: { status: "canceled" },
        }),
        cancel,
      },
    });

    await donations.cancelAllSubscriptions("user-1");

    expect(donation.getLatestPerSubscription).toHaveBeenCalledWith("user-1");
    expect(cancel.mock.calls.map(([id]) => id)).toEqual(["sub_a", "sub_b"]);
    expect(messages.send).not.toHaveBeenCalled();
  });

  it("alerts the admins when the player's subscriptions cannot be looked up", async () => {
    donation.getLatestPerSubscription.mockRejectedValue(
      new Error("connection terminated"),
    );
    const cancel = vi.fn();
    const donations = withStripe({ subscriptions: { cancel } });

    await donations.cancelAllSubscriptions("user-1");

    expect(cancel).not.toHaveBeenCalled();
    expect(messages.send).toHaveBeenCalledOnce();
    expect(messages.send.mock.calls[0][0].embeds.description).toContain(
      "user-1",
    );
  });

  it("still cancels the others and alerts the admins when Stripe refuses one", async () => {
    storedSubscriptions("sub_a", "sub_b");
    const cancel = vi.fn(async (id: string) => {
      if (id === "sub_a") throw new Error("Stripe is down");
      return {};
    });
    const donations = withStripe({
      subscriptions: {
        retrieve: stripeSubscriptions({
          sub_a: { status: "active" },
          sub_b: { status: "active" },
        }),
        cancel,
      },
    });

    await donations.cancelAllSubscriptions("user-1");

    expect(cancel).toHaveBeenCalledWith("sub_b");
    expect(messages.send).toHaveBeenCalledOnce();
    expect(messages.send.mock.calls[0][0].embeds.description).toContain(
      "sub_a",
    );
  });
});

describe("DonationService.createCheckoutSession", () => {
  const OPTS = {
    discordId: "user-1",
    amountCents: 500,
    successUrl: "https://createrington.com/donate/success",
    cancelUrl: "https://createrington.com/donate/cancel",
  };
  const CHECKOUT = { id: "cs_1", url: "https://checkout.stripe.com/1" };

  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    donation.getLatestPerSubscription.mockReset();
    storedSubscriptions("sub_1");
    create = vi.fn().mockResolvedValue(CHECKOUT);
  });

  function withSubscription(sub: StubSubscription) {
    return withStripe({
      subscriptions: { retrieve: stripeSubscriptions({ sub_1: sub }) },
      checkout: { sessions: { create } },
    });
  }

  it("refuses a monthly checkout while a subscription is live", async () => {
    const donations = withSubscription({
      status: "active",
      cancel_at_period_end: true,
    });

    await expect(
      donations.createCheckoutSession({ ...OPTS, type: "monthly" }),
    ).rejects.toThrow(ConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  it("opens a monthly checkout once the earlier subscription has ended", async () => {
    const donations = withSubscription({ status: "canceled" });

    await expect(
      donations.createCheckoutSession({ ...OPTS, type: "monthly" }),
    ).resolves.toEqual({ sessionId: CHECKOUT.id, url: CHECKOUT.url });
  });

  it("allows a one-time donation alongside a live subscription", async () => {
    const donations = withSubscription({ status: "active" });

    await donations.createCheckoutSession({ ...OPTS, type: "one_time" });

    expect(create).toHaveBeenCalledOnce();
  });
});
