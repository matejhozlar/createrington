import type { Pool, PoolClient } from "pg";
import { WaitlistEntryBaseQueries } from "@/generated/db/waitlist_entry.queries";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inclusive lower bounds for the three signup windows reported by getFunnelStats. */
export type SignupWindows = {
  today: Date;
  weekAgo: Date;
  monthAgo: Date;
};

/** Onboarding funnel counts: status breakdown, milestone, and signups per window. */
export type WaitlistFunnelStats = {
  total: number;
  queued: number;
  promoted: number;
  registered: number;
  expired: number;
  joinedMinecraft: number;
  signups: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
};

/**
 * Default signup window boundaries: local midnight today, plus the rolling
 * 7- and 30-day marks.
 *
 * Computed here rather than in SQL so "today" keeps following the server's
 * local timezone instead of the database session's.
 */
export function signupWindows(now: Date = new Date()): SignupWindows {
  return {
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    weekAgo: new Date(now.getTime() - 7 * DAY_MS),
    monthAgo: new Date(now.getTime() - 30 * DAY_MS),
  };
}

/**
 * Custom queries for waitlist_entry table
 *
 * - Onboarding funnel statistics: status breakdown, milestone progress counts,
 *   and first-time signups per window
 */
export class WaitlistEntryQueries extends WaitlistEntryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get waitlist funnel statistics
   *
   * Counts entries at each stage of the onboarding funnel in a single pass:
   * status breakdown (queued/promoted/registered/expired), the
   * joined-Minecraft milestone flag, and signups per time window.
   *
   * The signup windows read created_at, so an entry that returns to the
   * queue is not counted as a second signup.
   */
  async getFunnelStats(
    windows: SignupWindows = signupWindows(),
  ): Promise<WaitlistFunnelStats> {
    const query = `
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status = 'queued')::integer AS queued,
        COUNT(*) FILTER (WHERE status = 'promoted')::integer AS promoted,
        COUNT(*) FILTER (WHERE status = 'registered')::integer AS registered,
        COUNT(*) FILTER (WHERE status = 'expired')::integer AS expired,
        COUNT(*) FILTER (WHERE joined_minecraft = true)::integer AS joined_minecraft,
        COUNT(*) FILTER (WHERE created_at >= $1)::integer AS signups_today,
        COUNT(*) FILTER (WHERE created_at >= $2)::integer AS signups_this_week,
        COUNT(*) FILTER (WHERE created_at >= $3)::integer AS signups_this_month
      FROM ${this.table}`;

    const result = await this.runQuery<{
      total: number;
      queued: number;
      promoted: number;
      registered: number;
      expired: number;
      joined_minecraft: number;
      signups_today: number;
      signups_this_week: number;
      signups_this_month: number;
    }>("get waitlist funnel stats", query, [
      windows.today,
      windows.weekAgo,
      windows.monthAgo,
    ]);
    const row = result.rows[0];
    return {
      total: row.total,
      queued: row.queued,
      promoted: row.promoted,
      registered: row.registered,
      expired: row.expired,
      joinedMinecraft: row.joined_minecraft,
      signups: {
        today: row.signups_today,
        thisWeek: row.signups_this_week,
        thisMonth: row.signups_this_month,
      },
    };
  }
}
