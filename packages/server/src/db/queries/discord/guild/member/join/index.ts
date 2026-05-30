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
   * If the user already exists, returns their existing join number
   * This handles cases where a user leaves and rejoins
   *
   * @param userId - Discord user ID
   * @param username - Discord username
   * @returns The user's join number
   */
  async recordJoin(userId: string, username: string): Promise<number> {
    {
      const query = `
            INSERT INTO ${this.table} (user_id, username, joined_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id)
            DO NOTHING
            RETURNING join_number`;

      const result = await this.runQuery<{ join_number: number }>(
        "record member join",
        query,
        [userId, username],
      );

      if (result.rows.length === 0) {
        const existing = await this.find({ userId });
        if (!existing) {
          throw new Error("Failed to record join - no result returned");
        }
        return existing.joinNumber;
      }

      return result.rows[0].join_number;
    }
  }
}
