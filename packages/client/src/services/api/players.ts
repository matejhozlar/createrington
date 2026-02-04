import type { GetPlayersCountResponse } from "@createrington/shared/api";
import { api } from "./client";

/**
 * Player API endpoints
 */
export const playersApi = {
  /**
   * Get count of players matching optional filter criteria
   *
   * @param filters - Optional filter criteria
   * @param filters.online - Count only online players
   * @param filters.currentServerId - Count players on specific server
   * @param filters.createdAfter - Count players created after date (ISO 8601)
   * @param filters.createdBefore - Count players created before date (ISO 8601)
   * @param filters.lastSeenAfter - Count players last seen after date (ISO 8601)
   *
   * @returns The total count of players matching filters
   * @throws {Error} When the API request fails
   *
   * @example
   * // Get total player count
   * const total = await playersApi.getCount();
   *
   * @example
   * // Get online players only
   * const online = await playersApi.getCount({ online: true });
   *
   * @example
   * // Get players on server 1
   * const server1 = await playersApi.getCount({ currentServerId: 1 });
   */
  async getCount(filters?: {
    online?: boolean;
    currentServerId?: number;
    createdAfter?: string;
    createdBefore?: string;
    lastSeenAfter?: string;
  }): Promise<number> {
    const response = await api.get<GetPlayersCountResponse>(
      "api/players/count",
      filters,
    );
    return response.data.count;
  },
};
