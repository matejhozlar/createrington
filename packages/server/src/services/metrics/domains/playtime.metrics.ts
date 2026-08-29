import { Q } from "@/db";
import type { ServerHoursBreakdown } from "@/db/queries/player/playtime/summary";

/** Hours per live server, the retired-season total, and the two combined. */
export interface PlaytimeHoursBreakdown extends ServerHoursBreakdown {
  /** Hours from retired seasons, which have no server of their own */
  archivedHours: number;
}

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
   * // Get hours across all servers, including retired seasons
   * const hours = await metricsService.playtime.getTotalHours();
   * // Result: 5678
   */
  async getTotalHours(serverId?: number): Promise<number> {
    const liveHours = await Q.player.playtime.summary.getTotalHours(serverId);
    if (serverId !== undefined) return liveHours;

    const archivedHours = await Q.playtime.archive.getTotalHours();
    return liveHours + archivedHours;
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
    const [breakdown, archivedHours] = await Promise.all([
      Q.player.playtime.summary.getTotalHoursBreakdown(),
      Q.playtime.archive.getTotalHours(),
    ]);

    return {
      byServer: breakdown.byServer,
      archivedHours,
      total: breakdown.total + archivedHours,
    };
  }
}
