import type {
  GetAllServersResponse,
  GetServerResponse,
} from "@createrington/shared/api";
import { api } from "./client";

/**
 * Server Status API endpoints
 * Public endpoints for checking server status and player information
 */
export const serversApi = {
  /**
   * Get status for all servers
   *
   * @returns List of all servers with their status and summary statistics
   * @throws {Error} When the API request fails
   *
   * @example
   * const { servers, summary } = await serversApi.getAll();
   * console.log(`${summary.onlineServers}/${summary.totalServers} servers online`);
   * console.log(`${summary.totalPlayers} total players online`);
   */
  async getAll(): Promise<GetAllServersResponse["data"]> {
    const response = await api.get<GetAllServersResponse>("/api/servers");
    return response.data;
  },

  /**
   * Get status for a specific server
   *
   * @param id - Server ID
   * @returns Server status with online players
   * @throws {Error} When the API request fails or server not found
   *
   * @example
   * const { server } = await serversApi.getById(1);
   * console.log(`${server.serverName}: ${server.playerCount}/${server.maxPlayers} players`);
   * server.players.forEach(player => {
   *   console.log(`- ${player.username} (${player.secondsPlayed}s)`);
   * });
   */
  async getById(id: number): Promise<GetServerResponse["data"]> {
    const response = await api.get<GetServerResponse>(`/api/servers/${id}`);
    return response.data;
  },
};
