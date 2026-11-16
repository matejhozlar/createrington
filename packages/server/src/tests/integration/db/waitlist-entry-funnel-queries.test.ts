import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { Q } from "@/db";
import { getTestPool, cleanupTestPool } from "@/tests/helpers/db";

const SIGNED_UP_TODAY = "990000000000000101";
const SIGNED_UP_LONG_AGO_REQUEUED_TODAY = "990000000000000102";
const SIGNED_UP_LAST_WEEK = "990000000000000103";

const WINDOWS = {
  today: new Date("2100-01-31T00:00:00Z"),
  weekAgo: new Date("2100-01-24T00:00:00Z"),
  monthAgo: new Date("2100-01-01T00:00:00Z"),
};

async function seedEntry(discordId: string, createdAt: Date, queuedAt: Date) {
  await getTestPool().query(
    `INSERT INTO waitlist_entry (discord_id, discord_username, created_at, queued_at)
     VALUES ($1, $2, $3, $4)`,
    [discordId, `funnel-${discordId}`, createdAt, queuedAt],
  );
}

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

afterEach(async () => {
  await getTestPool().query(
    "DELETE FROM waitlist_entry WHERE discord_id = ANY($1)",
    [[SIGNED_UP_TODAY, SIGNED_UP_LONG_AGO_REQUEUED_TODAY, SIGNED_UP_LAST_WEEK]],
  );
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("Q.waitlist.entry.getFunnelStats", () => {
  it("counts each signup window by when the entry was created, not when it was last queued", async () => {
    await seedEntry(
      SIGNED_UP_TODAY,
      new Date("2100-01-31T10:00:00Z"),
      new Date("2100-01-31T10:00:00Z"),
    );
    await seedEntry(
      SIGNED_UP_LONG_AGO_REQUEUED_TODAY,
      new Date("2000-01-01T00:00:00Z"),
      new Date("2100-01-31T11:00:00Z"),
    );
    await seedEntry(
      SIGNED_UP_LAST_WEEK,
      new Date("2100-01-26T10:00:00Z"),
      new Date("2100-01-26T10:00:00Z"),
    );

    const stats = await Q.waitlist.entry.getFunnelStats(WINDOWS);

    expect(stats.signups).toEqual({ today: 1, thisWeek: 2, thisMonth: 2 });
  });
});
