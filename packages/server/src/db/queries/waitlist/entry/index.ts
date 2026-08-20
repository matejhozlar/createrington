import type { Pool, PoolClient } from "pg";
import { WaitlistEntryBaseQueries } from "@/generated/db/waitlist_entry.queries";

/**
 * Custom queries for waitlist_entry table
 *
 * - Onboarding funnel statistics: status breakdown and milestone progress counts
 */
export class WaitlistEntryQueries extends WaitlistEntryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get waitlist funnel statistics
   *
   * Counts entries at each stage of the onboarding funnel:
   * status breakdown (queued/promoted/registered/expired) and the
   * joined-Minecraft milestone flag.
   *
   * @returns Aggregate counts for each status and milestone
   */
  async getFunnelStats(): Promise<{
    total: number;
    queued: number;
    promoted: number;
    registered: number;
    expired: number;
    joinedMinecraft: number;
  }> {
    const query = `
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status = 'queued')::integer AS queued,
        COUNT(*) FILTER (WHERE status = 'promoted')::integer AS promoted,
        COUNT(*) FILTER (WHERE status = 'registered')::integer AS registered,
        COUNT(*) FILTER (WHERE status = 'expired')::integer AS expired,
        COUNT(*) FILTER (WHERE joined_minecraft = true)::integer AS joined_minecraft
      FROM ${this.table}`;

    const result = await this.runQuery<{
      total: number;
      queued: number;
      promoted: number;
      registered: number;
      expired: number;
      joined_minecraft: number;
    }>("get waitlist funnel stats", query);
    const row = result.rows[0];
    return {
      total: row.total,
      queued: row.queued,
      promoted: row.promoted,
      registered: row.registered,
      expired: row.expired,
      joinedMinecraft: row.joined_minecraft,
    };
  }
}
