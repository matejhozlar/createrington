import { Q } from "@/db";
import type { PlaytimeHoursBreakdown } from "@/db/queries/player/playtime/summary";

/**
 * Playtime Metrics Domain
 */
export class PlaytimeMetrics {
  /**
   * Get total hours played
   *
   * Simple, optimized method that returns rounded hours.
   *
   * @param serverId - Optional server ID
   * @returns Total hours played
   *
   * @example
   * // Get hours for specific server
   * const hours = await metricsService.playtime.getTotalHours(1);
   * // Result: 1234
   *
   * @example
   * // Get hours across all servers
   * const hours = await metricsService.playtime.getTotalHours();
   * // Result: 5678
   */
  async getTotalHours(serverId?: number): Promise<number> {
    return await Q.player.playtime.summary.getTotalHours(serverId);
  }

  /**
   * Get total hours with server breakdown
   *
   * Returns hours per server plus global total.
   *
   * @returns Object with server breakdown and total
   *
   * @example
   * const breakdown = await metricsService.playtime.getTotalHoursBreakdown();
   * // {
   * //   byServer: [
   * //     { serverId: 1, serverName: "Survival", hours: 1234 },
   * //     { serverId: 2, serverName: "Creative", hours: 987 }
   * //   ],
   * //   total: 2222
   * // }
   */
  async getTotalHoursBreakdown(): Promise<PlaytimeHoursBreakdown> {
    return await Q.player.playtime.summary.getTotalHoursBreakdown();
  }
}
