import { Pool, type PoolClient } from "pg";
import { PlayerBaseQueries } from "@/generated/db/player.queries";

/**
 * Custom queries for player table
 *
 * Extends the auto-generated base class with custom methods
 */
export class PlayerQueries extends PlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
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

    try {
      const result = await this.db.query<{ period: string; count: number }>(
        query,
        [start, end, granularity],
      );
      return result.rows;
    } catch (error) {
      logger.error("Failed to get registrations by period:", error);
      throw error;
    }
  }
}
