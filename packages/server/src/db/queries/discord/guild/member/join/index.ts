import type { Pool, PoolClient } from "pg";
import { DiscordGuildMemberJoinBaseQueries } from "@/generated/db/discord_guild_member_join.queries";

/**
 * Custom queries for discord_guild_member_join table
 *
 * - Time-series join analytics per period
 * - Idempotent join recording with sequential join_number assignment
 */
export class DiscordGuildMemberJoinQueries extends DiscordGuildMemberJoinBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get guild member joins grouped by time period
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with join counts
   */
  async getJoinsByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<Array<{ period: string; count: number }>> {
    const query = `
      SELECT
        DATE_TRUNC($3, joined_at)::text AS period,
        COUNT(*)::integer AS count
      FROM ${this.table}
      WHERE joined_at >= $1 AND joined_at < $2
      GROUP BY 1
      ORDER BY 1`;

    const result = await this.runQuery<{ period: string; count: number }>(
      "get joins by period",
      query,
      [start, end, granularity],
    );
    return result.rows;
  }

  /**
   * Records a new member join and returns their join number
   *
   * If the user already exists, returns their existing join number without
   * consuming a value from the join_number sequence, so rejoins and repeated
   * calls for the same member never leave gaps in the numbering
   *
   * The fallback lookup is deliberately a separate statement: it runs in a
   * fresh snapshot and sees the row a concurrent first-time insert has just
   * committed. Folding it into the insert as a CTE would read the insert's
   * own snapshot and return nothing in that race
   */
  async recordJoin(userId: string, username: string): Promise<number> {
    const query = `
      INSERT INTO ${this.table} (user_id, username, joined_at)
      SELECT $1::varchar, $2::varchar, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM ${this.table} WHERE user_id = $1::varchar)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING join_number`;

    const result = await this.runQuery<{ join_number: number }>(
      "record member join",
      query,
      [userId, username],
    );

    if (result.rows.length > 0) {
      return result.rows[0].join_number;
    }

    const existing = await this.find({ userId });
    if (!existing) {
      throw new Error("Failed to record join - no result returned");
    }
    return existing.joinNumber;
  }
}
