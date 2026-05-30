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
   * status breakdown (pending/accepted/auto_accepted/declined/completed)
   * and boolean milestone flags (joinedDiscord, verified, registered, joinedMinecraft).
   *
   * @returns Aggregate counts for each status and milestone
   */
  async getFunnelStats(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    autoAccepted: number;
    declined: number;
    completed: number;
    joinedDiscord: number;
    verified: number;
    registered: number;
    joinedMinecraft: number;
  }> {
    const query = `
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending,
        COUNT(*) FILTER (WHERE status = 'accepted')::integer AS accepted,
        COUNT(*) FILTER (WHERE status = 'auto_accepted')::integer AS auto_accepted,
        COUNT(*) FILTER (WHERE status = 'declined')::integer AS declined,
        COUNT(*) FILTER (WHERE status = 'completed')::integer AS completed,
        COUNT(*) FILTER (WHERE joined_discord = true)::integer AS joined_discord,
        COUNT(*) FILTER (WHERE verified = true)::integer AS verified,
        COUNT(*) FILTER (WHERE registered = true)::integer AS registered,
        COUNT(*) FILTER (WHERE joined_minecraft = true)::integer AS joined_minecraft
      FROM ${this.table}`;

    const result = await this.runQuery<{
      total: number;
      pending: number;
      accepted: number;
      auto_accepted: number;
      declined: number;
      completed: number;
      joined_discord: number;
      verified: number;
      registered: number;
      joined_minecraft: number;
    }>("get waitlist funnel stats", query);
    const row = result.rows[0];
    return {
      total: row.total,
      pending: row.pending,
      accepted: row.accepted,
      autoAccepted: row.auto_accepted,
      declined: row.declined,
      completed: row.completed,
      joinedDiscord: row.joined_discord,
      verified: row.verified,
      registered: row.registered,
      joinedMinecraft: row.joined_minecraft,
    };
  }
}
