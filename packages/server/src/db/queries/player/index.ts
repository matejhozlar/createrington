import { Pool, type PoolClient } from "pg";
import { PlayerBaseQueries } from "@/generated/db/player.queries";

/**
 * Custom queries for player table
 *
 * - Inherits standard CRUD from PlayerBaseQueries
 * - Adds registration analytics (getRegistrationsByPeriod)
 * - Adds whitelist entry generation (getWhitelistEntries)
 */
export class PlayerQueries extends PlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get whitelist entries for every registered player without an active ban,
   * shaped to match Minecraft's whitelist.json format.
   *
   * @returns Array of { uuid, name }, ordered by username
   */
  async getWhitelistEntries(): Promise<Array<{ uuid: string; name: string }>> {
    const query = `
      SELECT minecraft_uuid AS uuid, minecraft_username AS name
      FROM ${this.table}
      WHERE minecraft_uuid NOT IN (
        SELECT player_minecraft_uuid
        FROM player_ban
        WHERE unbanned = false
          AND (expires_at IS NULL OR expires_at > NOW())
      )
      ORDER BY minecraft_username`;

    const result = await this.runQuery<{ uuid: string; name: string }>(
      "get whitelist entries",
      query,
    );
    return result.rows;
  }

  /**
   * Get player registrations grouped by time period
   *
   * Counts new player records by their created_at timestamp.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with registration counts
   */
  async getRegistrationsByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<Array<{ period: string; count: number }>> {
    const query = `
      SELECT
        DATE_TRUNC($3, created_at)::text AS period,
        COUNT(*)::integer AS count
      FROM ${this.table}
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY 1
      ORDER BY 1`;

    const result = await this.runQuery<{ period: string; count: number }>(
      "get registrations by period",
      query,
      [start, end, granularity],
    );
    return result.rows;
  }
}
