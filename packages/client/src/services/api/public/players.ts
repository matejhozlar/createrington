import type {
  GetPlayersQuery,
  GetPlayersCountQuery,
  GetPlayersCountResponse,
  GetPlayerResponse,
  GetPlayersResponse,
} from "@createrington/shared/api/public/players";
import type { Serialize } from "@createrington/shared/api/utils";
import { api } from "../client";

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
    // Serialize<T> tells TypeScript that Dates become strings on client
    const response = await api.get<Serialize<GetPlayersCountResponse>>(
      "/api/players/count",
      filters,
    );
    return response.data.count;
  },

  /**
   * Get a single player by Discord ID or Minecraft UUID
   *
   * @param id - Discord ID or Minecraft UUID
   * @returns Player data (with dates as strings)
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const player = await playersApi.getById("123456789012345678");
   * // player.createdAt is string (not Date)
   * console.log(new Date(player.createdAt).toLocaleDateString());
   */
  async getById(id: string): Promise<Serialize<GetPlayerResponse>["data"]> {
    // Serialize<GetPlayerResponse> = { success: true, data: { createdAt: string, ... } }
    const response = await api.get<Serialize<GetPlayerResponse>>(
      `/api/players/${id}`,
    );
    return response.data;
  },

  /**
   * Get all players with optional filtering, pagination, and sorting
   *
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns Players and pagination metadata (dates as strings)
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
  ): Promise<Serialize<GetPlayersResponse>["data"]> {
    // Serialize transforms all Date fields to string
    const response = await api.get<Serialize<GetPlayersResponse>>(
      "/api/players",
      query,
    );
    return response.data;
  },
};
