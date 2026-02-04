import {
  GetPlayersResponse,
  type GetPlayerResponse,
  type GetPlayersCountQuery,
  type GetPlayersCountResponse,
  type GetPlayersQuery,
} from "@createrington/shared/api";
import { api } from "./client";

/**
 * Player API endpoints
 */
export const playersApi = {
  /**
   * Get count of players matching optional filter criteria
   *
   * @param filters - Optional filter criteria
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
  async getCount(filters?: GetPlayersCountQuery): Promise<number> {
    const response = await api.get<GetPlayersCountResponse>(
      "/api/players/count",
      filters,
    );
    return response.data.count;
  },

  /**
   * Get a single player by Discord ID or Minecraft UUID
   *
   * @param id - Discord ID or Minecraft UUID
   * @returns Player data
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const player = await playersApi.getById("123456789012345678");
   */
  async getById(id: string): Promise<GetPlayerResponse["data"]> {
    const response = await api.get<GetPlayerResponse>(`/api/players/${id}`);
    return response.data;
  },

  /**
   * Get all players with optional filtering, pagination, and sorting
   *
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns Players and pagination metadata
   * @throws {Error} When the API request fails
   *
   * @example
   * // Get first page with defaults
   * const result = await playersApi.getAll();
   *
   * @example
   * // Get online players, sorted by username
   * const result = await playersApi.getAll({
   *   isActive: true,
   *   sortBy: "minecraftUsername",
   *   sortOrder: "ASC",
   *   page: 0,
   *   limit: 50,
   * });
   */
  async getAll(
    query?: Partial<GetPlayersQuery>,
  ): Promise<GetPlayersResponse["data"]> {
    const response = await api.get<GetPlayersResponse>("/api/players", query);
    return response.data;
  },
};
