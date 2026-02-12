import { Q } from "@/db";

/**
 * Activity Metrics Domain
 *
 * Surfaces player engagement data for the admin dashboard:
 * - Unique active players over time
 * - Peak concurrent player count
 * - Average session duration
 * - New vs returning player breakdown
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
   * Get peak concurrent player count within a time range
   *
   * @param start - Start of the date range
   * @param end - End of the date range
   * @returns Peak count and the timestamp it occurred at
   */
  async getPeakConcurrent(start: Date, end: Date) {
    return await Q.player.session.getPeakConcurrent(start, end);
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

  /**
   * Get new vs returning player breakdown per day
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @returns Array of dates with new and returning player counts
   */
  async getNewVsReturning(start: Date, end: Date) {
    return await Q.player.session.getNewVsReturning(start, end);
  }
}
