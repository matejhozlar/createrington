import type { Pool, PoolClient } from "pg";
import { DiscordGuildMemberLeaveBaseQueries } from "@/generated/db/discord_guild_member_leave.queries";

/**
 * Custom queries for discord_guild_member_leave table
 *
 * - Time-series leave analytics per period (excludes soft-deleted records)
 * - Expired member discovery (departed 30+ days ago, not yet cleaned up)
 */
export class DiscordGuildMemberLeaveQueries extends DiscordGuildMemberLeaveBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get guild member leaves grouped by time period
   *
   * Excludes soft-deleted records (deleted_at IS NULL).
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with leave counts
   */
  async getLeavesByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<Array<{ period: string; count: number }>> {
    const query = `
      SELECT
        DATE_TRUNC($3, departed_at)::text AS period,
        COUNT(*)::integer AS count
      FROM ${this.table}
      WHERE departed_at >= $1 AND departed_at < $2
        AND deleted_at IS NULL
      GROUP BY 1
      ORDER BY 1`;

    try {
      const result = await this.db.query<{ period: string; count: number }>(
        query,
        [start, end, granularity],
      );
      return result.rows;
    } catch (error) {
      logger.error("Failed to get leaves by period:", error);
      throw error;
    }
  }

  /**
   * Finds all members who departed more than 30 days ago
   * and haven't been deleted
   *
   * @returns Promise resolving to an Array of departed members
   */
  async expired(): Promise<
    Array<{
      id: number;
      discordId: string;
      minecraftUuid: string;
      minecraftUsername: string;
      notificationMessageId: string | null;
      departedAt: Date;
    }>
  > {
    const query = `
    SELECT id, discord_id, minecraft_uuid, minecraft_username, notification_message_id, departed_at
    FROM ${this.table}
    WHERE departed_at < NOW() - INTERVAL '30 days'
      AND deleted_at IS NULL`;

    try {
      const result = await this.db.query(query);
      return result.rows.flatMap((row) => this.mapRowsToEntities(row));
    } catch (error) {
      console.error("Error fetching expired members:", error);
      throw error;
    }
  }
}
