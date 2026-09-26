import { Q } from "@/db";

/**
 * Activity Metrics Domain
 *
 * Surfaces player engagement data for the admin dashboard:
 * - Unique active players over time
 * - Average session duration
 */
export class ActivityMetrics {
  /**
   * Get unique active player counts by time period
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Array of periods with unique player counts
   */
  async getActivePlayers(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    return await Q.player.session.getActivePlayerCounts(
      start,
      end,
      granularity,
    );
  }

  /**
   * Get average session length in seconds
   *
   * @param start - Optional start of date range (inclusive)
   * @param end - Optional end of date range (exclusive)
   * @returns Average duration in seconds
   */
  async getAverageSessionLength(start?: Date, end?: Date) {
    return await Q.player.session.getAverageSessionLength(start, end);
  }
}
