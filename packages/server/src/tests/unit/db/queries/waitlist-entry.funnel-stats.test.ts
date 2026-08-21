import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  WaitlistEntryQueries,
  signupWindows,
} from "@/db/queries/waitlist/entry";

const DAY_MS = 24 * 60 * 60 * 1000;

const ROW = {
  total: 12,
  queued: 5,
  promoted: 2,
  registered: 4,
  expired: 1,
  joined_minecraft: 3,
  signups_today: 1,
  signups_this_week: 2,
  signups_this_month: 6,
};

const WINDOWS = {
  today: new Date(2026, 7, 21),
  weekAgo: new Date(2026, 7, 14, 15, 30),
  monthAgo: new Date(2026, 6, 22, 15, 30),
};

function stubbed() {
  const query = vi.fn().mockResolvedValue({ rows: [ROW] });
  const queries = new WaitlistEntryQueries({ query } as unknown as Pool);
  return { queries, query };
}

describe("WaitlistEntryQueries.getFunnelStats", () => {
  it("collapses the whole funnel into a single round-trip", async () => {
    const { queries, query } = stubbed();

    await queries.getFunnelStats(WINDOWS);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("counts every signup window from created_at, never queued_at", async () => {
    const { queries, query } = stubbed();

    await queries.getFunnelStats(WINDOWS);

    const sql = query.mock.calls[0][0] as string;
    expect(sql.match(/created_at >= \$\d/g)).toHaveLength(3);
    expect(sql).not.toContain("queued_at");
  });

  it("passes the window boundaries as parameters, widest last", async () => {
    const { queries, query } = stubbed();

    await queries.getFunnelStats(WINDOWS);

    expect(query.mock.calls[0][1]).toEqual([
      WINDOWS.today,
      WINDOWS.weekAgo,
      WINDOWS.monthAgo,
    ]);
  });

  it("maps the aggregate row onto the funnel and signup shape", async () => {
    const { queries } = stubbed();

    expect(await queries.getFunnelStats(WINDOWS)).toEqual({
      total: 12,
      queued: 5,
      promoted: 2,
      registered: 4,
      expired: 1,
      joinedMinecraft: 3,
      signups: { today: 1, thisWeek: 2, thisMonth: 6 },
    });
  });

  it("falls back to the default windows when none are supplied", async () => {
    const { queries, query } = stubbed();

    await queries.getFunnelStats();

    const params = query.mock.calls[0][1] as Date[];
    expect(params).toHaveLength(3);
    expect(params.every((value) => value instanceof Date)).toBe(true);
  });
});

describe("signupWindows", () => {
  const now = new Date(2026, 7, 21, 15, 30, 45);

  it("anchors today to the server's local midnight, not UTC midnight", () => {
    expect(signupWindows(now).today).toEqual(new Date(2026, 7, 21, 0, 0, 0, 0));
  });

  it("rolls the week and month windows back from the exact moment", () => {
    const windows = signupWindows(now);

    expect(windows.weekAgo.getTime()).toBe(now.getTime() - 7 * DAY_MS);
    expect(windows.monthAgo.getTime()).toBe(now.getTime() - 30 * DAY_MS);
  });
});
