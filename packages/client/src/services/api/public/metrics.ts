import type {
  GetPlaytimeHoursQuery,
  GetPlaytimeHoursResponse,
  GetPlaytimeHoursBreakdownResponse,
} from "@createrington/shared/api/public/metrics";
import { api } from "../client";

/**
 * Metrics API endpoints
 * All routes are PUBLIC - no authentication required
 */
export const metricsApi = {
  // ============================================================================
  // PLAYTIME METRICS
  // ============================================================================

  /**
   * Get total hours played
   *
   * Returns floored total hours for a specific server or across all servers.
   * Hours are calculated by summing all player playtime and dividing by 3600.
   *
   * @param query - Optional query parameters for filtering
   * @param query.serverId - Server ID to filter by (omit for all servers)
   * @returns Total hours data with server context
   * @throws {Error} When the API request fails
   *
   * @example
   * // Get total hours across all servers
   * const result = await metricsApi.playtime.getTotalHours();
   * // { serverId: null, totalHours: 5678 }
   *
   * @example
   * // Get total hours for specific server
   * const result = await metricsApi.playtime.getTotalHours({ serverId: 1 });
   * // { serverId: 1, totalHours: 1234 }
   */
  playtime: {
    async getTotalHours(
      query?: GetPlaytimeHoursQuery,
    ): Promise<GetPlaytimeHoursResponse["data"]> {
      const response = await api.get<GetPlaytimeHoursResponse>(
        "/api/metrics/playtime/hours",
        query,
      );
      return response.data;
    },

    /**
     * Get hours breakdown by server
     *
     * Returns floored hours for each server plus a global total.
     * Useful for displaying server comparison charts or statistics dashboards.
     *
     * @returns Breakdown with per-server hours and global total
     * @throws {Error} When the API request fails
     *
     * @example
     * const breakdown = await metricsApi.playtime.getHoursBreakdown();
     * // {
     * //   byServer: [
     * //     { serverId: 1, serverName: "Survival", hours: 1234 },
     * //     { serverId: 2, serverName: "Creative", hours: 987 }
     * //   ],
     * //   total: 2221
     * // }
     */
    async getHoursBreakdown(): Promise<
      GetPlaytimeHoursBreakdownResponse["data"]
    > {
      const response = await api.get<GetPlaytimeHoursBreakdownResponse>(
        "/api/metrics/playtime/hours/breakdown",
      );
      return response.data;
    },
  },
};
