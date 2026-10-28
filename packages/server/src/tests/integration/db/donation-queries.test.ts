import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const DONOR = "779300000000000001";
const HOUR = 60 * 60 * 1000;

afterAll(async () => {
  await Q.donation.deleteAll({ playerDiscordId: DONOR });
});

beforeEach(async () => {
  await Q.donation.deleteAll({ playerDiscordId: DONOR });
});

describe("Q.donation.getLatestPerSubscription", () => {
  it("keeps the newest completed monthly row of each subscription", async () => {
    const base = Date.now() - 10 * HOUR;
    await Q.donation.createMany([
      {
        playerDiscordId: DONOR,
        type: "monthly",
        amountCents: 500,
        status: "completed",
        stripeSessionId: "donation-test-old",
        stripeSubscriptionId: "sub_test_a",
        createdAt: new Date(base),
      },
      {
        playerDiscordId: DONOR,
        type: "monthly",
        amountCents: 1000,
        status: "completed",
        stripeSessionId: "donation-test-new",
        stripeSubscriptionId: "sub_test_a",
        createdAt: new Date(base + HOUR),
      },
      {
        playerDiscordId: DONOR,
        type: "monthly",
        amountCents: 9999,
        status: "pending",
        stripeSessionId: "donation-test-pending",
        stripeSubscriptionId: "sub_test_a",
        createdAt: new Date(base + 2 * HOUR),
      },
      {
        playerDiscordId: DONOR,
        type: "monthly",
        amountCents: 300,
        status: "completed",
        stripeSessionId: "donation-test-b",
        stripeSubscriptionId: "sub_test_b",
        createdAt: new Date(base),
      },
      {
        playerDiscordId: DONOR,
        type: "one_time",
        amountCents: 2000,
        status: "completed",
        stripeSessionId: "donation-test-once",
        createdAt: new Date(base),
      },
    ]);

    const rows = (await Q.donation.getLatestPerSubscription()).filter(
      (row) => row.playerDiscordId === DONOR,
    );

    expect(
      rows.map((row) => [row.stripeSubscriptionId, row.amountCents]).sort(),
    ).toEqual([
      ["sub_test_a", 1000],
      ["sub_test_b", 300],
    ]);
  });
});
