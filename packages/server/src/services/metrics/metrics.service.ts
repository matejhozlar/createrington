import { Q } from "@/db";
import type { ServerHoursBreakdown } from "@/db/queries/player/playtime/summary";
import type { Granularity } from "@/db/utils";

export interface PlaytimeHoursBreakdown extends ServerHoursBreakdown {
  archivedHours: number;
}

/**
 * Metrics that combine several queries or derive values from them. Single-query
 * metrics are read straight from `Q` by their routers. Stateless DB layer: no
 * async init and no service-container dependencies.
 */
export class MetricsService {
  /** Rounded hours played on one server, or across all servers plus retired seasons when `serverId` is omitted. */
  async getTotalHours(serverId?: number): Promise<number> {
    const liveHours = await Q.player.playtime.summary.getTotalHours(serverId);
    if (serverId !== undefined) return liveHours;

    const archivedHours = await Q.playtime.archive.getTotalHours();
    return liveHours + archivedHours;
  }

  /** Hours per live server, the retired-season hours, and the combined total. */
  async getHoursBreakdown(): Promise<PlaytimeHoursBreakdown> {
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

  /** Total balance in circulation, holder count, and the average balance per holder. */
  async getEconomyOverview() {
    const { totalBalance, playerCount } =
      await Q.player.balance.getTotalInCirculation();
    return {
      totalBalance,
      playerCount,
      averageBalance: playerCount > 0 ? totalBalance / playerCount : 0,
    };
  }

  /** Discord member joins and leaves bucketed by period. */
  async getDiscordGrowth(start: Date, end: Date, granularity: Granularity) {
    const [joins, leaves] = await Promise.all([
      Q.discord.guild.member.join.getJoinsByPeriod(start, end, granularity),
      Q.discord.guild.member.leave.getLeavesByPeriod(start, end, granularity),
    ]);

    return { joins, leaves };
  }
}

export const metricsService = new MetricsService();
