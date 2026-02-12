import { Q } from "@/db";

/**
 * Moderation Metrics Domain
 *
 * Surfaces moderation activity data for the admin dashboard:
 * - Ban counts over time with type breakdown
 * - Strike counts over time with classification breakdown
 * - Active strike severity distribution
 * - Ticket overview and volume trends
 * - Moderator leaderboard by ban count
 */
export class ModerationMetrics {
  /**
   * Get ban counts by time period with type breakdown
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Array of periods with total, temporary, and permanent counts
   */
  async getBansByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    return await Q.player.ban.getCountsByPeriod(start, end, granularity);
  }

  /**
   * Get strike counts by time period with classification breakdown
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Array of periods with total and per-classification counts
   */
  async getStrikesByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    return await Q.player.strike.getCountsByPeriod(start, end, granularity);
  }

  /**
   * Get severity distribution for active (non-removed) strikes
   *
   * @returns Array of severity levels with their counts
   */
  async getStrikeSeverityDistribution() {
    return await Q.player.strike.getSeverityDistribution();
  }

  /**
   * Get ticket overview: totals by status and average resolution time
   *
   * @returns Aggregate ticket statistics
   */
  async getTicketOverview() {
    return await Q.ticket.getOverview();
  }

  /**
   * Get ticket volume by time period (opened and closed)
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Array of periods with opened and closed counts
   */
  async getTicketVolume(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    return await Q.ticket.getVolumeByPeriod(start, end, granularity);
  }

  /**
   * Get top moderators ranked by ban count
   *
   * @param limit - Maximum number of moderators to return
   * @returns Array of moderators with Discord ID, username, and ban count
   */
  async getTopModerators(limit: number = 10) {
    return await Q.player.ban.getModeratorActivity(limit);
  }
}
