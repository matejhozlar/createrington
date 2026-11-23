import type { Pool, PoolClient } from "pg";
import { DiscordGuildMemberLeaveBaseQueries } from "@/generated/db/discord_guild_member_leave.queries";
import type { Granularity } from "@/db/utils";

export interface DepartureRow {
  id: number;
  discord_id: string;
  minecraft_uuid: string;
  minecraft_username: string;
  notification_message_id: string | null;
  departed_at: Date;
}

const DEPARTURE_COLUMNS =
  "id, discord_id, minecraft_uuid, minecraft_username, notification_message_id, departed_at";

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
    granularity: Granularity = "day",
  ): Promise<Array<{ period: string; count: number }>> {
    return this.aggregateByPeriod<{ count: number }>(
      "get leaves by period",
      "departedAt",
      { count: "COUNT(*)::int" },
      start,
      end,
      granularity,
      "deleted_at IS NULL",
    );
  }

  /**
   * Finds the active (non-deleted) departure record for a given Discord user
   */
  async findActive(discordId: string) {
    const result = await this.runQuery<DepartureRow>(
      "fetch active departure record",
      `SELECT ${DEPARTURE_COLUMNS}
       FROM ${this.table}
       WHERE discord_id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [discordId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Finds all members who departed more than 30 days ago
   * and haven't been deleted
   *
   * @returns Promise resolving to an Array of departed members
   */
  async getExpired() {
    const result = await this.runQuery<DepartureRow>(
      "fetch expired members",
      `SELECT ${DEPARTURE_COLUMNS}
       FROM ${this.table}
       WHERE departed_at < NOW() - INTERVAL '30 days'
         AND deleted_at IS NULL`,
    );
    return this.mapRowsToEntities(result.rows);
  }
}
