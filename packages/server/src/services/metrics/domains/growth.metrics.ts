import { Q } from "@/db";

/**
 * Growth Metrics Domain
 *
 * Surfaces community growth data for the admin dashboard:
 * - Total registered player count
 * - Player registrations over time
 * - Waitlist onboarding funnel conversion rates
 * - Discord server join/leave trends
 */
export class GrowthMetrics {
  /**
   * Get growth overview with total player count
   *
   * @returns Object containing totalPlayers
   */
  async getOverview() {
    const totalPlayers = await Q.player.count();
    return { totalPlayers };
  }

  /**
   * Get player registrations by time period
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Array of periods with registration counts
   */
  async getRegistrations(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    return await Q.player.getRegistrationsByPeriod(start, end, granularity);
  }

  /**
   * Get waitlist funnel statistics
   *
   * @returns Counts at each stage of the onboarding funnel
   */
  async getWaitlistFunnel() {
    return await Q.waitlist.entry.getFunnelStats();
  }

  /**
   * Get Discord server growth (joins and leaves) by time period
   *
   * Runs join and leave queries in parallel for efficiency.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval
   * @returns Object with separate joins and leaves arrays
   */
  async getDiscordGrowth(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ) {
    const [joins, leaves] = await Promise.all([
      Q.discord.guild.member.join.getJoinsByPeriod(start, end, granularity),
      Q.discord.guild.member.leave.getLeavesByPeriod(start, end, granularity),
    ]);

    return { joins, leaves };
  }
}
