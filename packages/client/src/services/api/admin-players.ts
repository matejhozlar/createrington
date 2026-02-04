import type {
  GetAdminPlayerResponse,
  GetAdminPlayersResponse,
  GetAdminPlayersQuery,
  UpdateAdminPlayerResponse,
  UpdateAdminPlayerBody,
  DeleteAdminPlayerResponse,
  DeleteAdminPlayerBody,
  GetPlayerBalanceResponse,
  GetPlayerBalanceQuery,
  AdjustPlayerBalanceResponse,
  AdjustPlayerBalanceBody,
  GetPlayerAuditLogResponse,
  GetPlayerAuditLogQuery,
  GetPlayerPlaytimeResponse,
  GetPlayerSessionsResponse,
  GetPlayerSessionsQuery,
  GetPlayerTicketsResponse,
  GetPlayerTicketsQuery,
  GetPlayerStrikesResponse,
  GetPlayerStrikesQuery,
  IssueStrikeResponse,
  IssueStrikeBody,
  RemoveStrikeResponse,
  RemoveStrikeBody,
  GetAdminPlayerStatsResponse,
  BulkBalanceAdjustResponse,
  BulkBalanceAdjustBody,
} from "@createrington/shared/api";
import { api } from "./client";

/**
 * Admin Player API endpoints
 * All routes require ADMIN authentication level
 */
export const adminPlayerApi = {
  /**
   * Get detailed player information for admin panel
   *
   * @param id - Discord ID or Minecraft UUID
   * @returns Detailed player data including balance, playtime, tickets, waitlist, and strikes
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const player = await adminPlayerApi.getById("123456789012345678");
   */
  async getById(id: string): Promise<GetAdminPlayerResponse["data"]> {
    const response = await api.get<GetAdminPlayerResponse>(
      `/api/admin/players/${id}`,
    );
    return response.data;
  },

  /**
   * Get list of players with enhanced admin data
   *
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns Players and pagination metadata
   * @throws {Error} When the API request fails
   *
   * @example
   * // Get first page with defaults
   * const result = await adminPlayerApi.getAll();
   *
   * @example
   * // Get online players, sorted by last seen
   * const result = await adminPlayerApi.getAll({
   *   online: true,
   *   orderBy: "lastSeen",
   *   orderDirection: "DESC",
   *   page: 0,
   *   limit: 50,
   * });
   */
  async getAll(
    query?: Partial<GetAdminPlayersQuery>,
  ): Promise<GetAdminPlayersResponse["data"]> {
    const response = await api.get<GetAdminPlayersResponse>(
      "/api/admin/players",
      query,
    );
    return response.data;
  },

  /**
   * Update player data
   *
   * @param id - Discord ID or Minecraft UUID
   * @param body - Update data including reason
   * @returns Updated player data
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const updated = await adminPlayerApi.update("123456789012345678", {
   *   minecraftUsername: "NewUsername",
   *   reason: "Player requested username change"
   * });
   */
  async update(
    id: string,
    body: UpdateAdminPlayerBody,
  ): Promise<UpdateAdminPlayerResponse["data"]> {
    const response = await api.patch<UpdateAdminPlayerResponse>(
      `/api/admin/players/${id}`,
      body,
    );
    return response.data;
  },

  /**
   * Completely delete a player and all associated data
   *
   * @param id - Discord ID or Minecraft UUID
   * @param body - Delete reason
   * @returns Success message
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * await adminPlayerApi.delete("123456789012345678", {
   *   reason: "Account deletion requested by player"
   * });
   */
  async delete(
    id: string,
    body: DeleteAdminPlayerBody,
  ): Promise<DeleteAdminPlayerResponse> {
    const response = await api.delete<DeleteAdminPlayerResponse>(
      `/api/admin/players/${id}`,
      body,
    );
    return response;
  },

  /**
   * Get player balance with recent transactions
   *
   * @param id - Discord ID or Minecraft UUID
   * @param query - Query parameters (limit for recent transactions)
   * @returns Balance information with recent transactions
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const balance = await adminPlayerApi.getBalance("123456789012345678", {
   *   limit: 20
   * });
   */
  async getBalance(
    id: string,
    query?: GetPlayerBalanceQuery,
  ): Promise<GetPlayerBalanceResponse["data"]> {
    const response = await api.get<GetPlayerBalanceResponse>(
      `/api/admin/players/${id}/balance`,
      query,
    );
    return response.data;
  },

  /**
   * Adjust player balance (add or subtract)
   *
   * @param id - Discord ID or Minecraft UUID
   * @param body - Amount (positive to add, negative to subtract) and reason
   * @returns New balance and adjustment amount
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * // Add balance
   * const result = await adminPlayerApi.adjustBalance("123456789012345678", {
   *   amount: 1000,
   *   reason: "Compensation for server issue"
   * });
   *
   * @example
   * // Subtract balance
   * const result = await adminPlayerApi.adjustBalance("123456789012345678", {
   *   amount: -500,
   *   reason: "Penalty for rule violation"
   * });
   */
  async adjustBalance(
    id: string,
    body: AdjustPlayerBalanceBody,
  ): Promise<AdjustPlayerBalanceResponse["data"]> {
    const response = await api.post<AdjustPlayerBalanceResponse>(
      `/api/admin/players/${id}/balance/adjust`,
      body,
    );
    return response.data;
  },

  /**
   * Get admin action audit log for a player
   *
   * @param id - Discord ID or Minecraft UUID
   * @param query - Query parameters for pagination
   * @returns Audit log actions and pagination metadata
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const auditLog = await adminPlayerApi.getAuditLog("123456789012345678", {
   *   page: 0,
   *   limit: 50
   * });
   */
  async getAuditLog(
    id: string,
    query?: GetPlayerAuditLogQuery,
  ): Promise<GetPlayerAuditLogResponse["data"]> {
    const response = await api.get<GetPlayerAuditLogResponse>(
      `/api/admin/players/${id}/audit-log`,
      query,
    );
    return response.data;
  },

  /**
   * Get player playtime statistics
   *
   * @param id - Discord ID or Minecraft UUID
   * @returns Playtime summary, total seconds, and total sessions
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const playtime = await adminPlayerApi.getPlaytime("123456789012345678");
   */
  async getPlaytime(id: string): Promise<GetPlayerPlaytimeResponse["data"]> {
    const response = await api.get<GetPlayerPlaytimeResponse>(
      `/api/admin/players/${id}/playtime`,
    );
    return response.data;
  },

  /**
   * Get player session history
   *
   * @param id - Discord ID or Minecraft UUID
   * @param query - Query parameters for filtering and pagination
   * @returns Sessions and pagination metadata
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * // Get all sessions
   * const sessions = await adminPlayerApi.getSessions("123456789012345678");
   *
   * @example
   * // Get sessions for specific server
   * const sessions = await adminPlayerApi.getSessions("123456789012345678", {
   *   serverId: 1,
   *   page: 0,
   *   limit: 100
   * });
   */
  async getSessions(
    id: string,
    query?: GetPlayerSessionsQuery,
  ): Promise<GetPlayerSessionsResponse["data"]> {
    const response = await api.get<GetPlayerSessionsResponse>(
      `/api/admin/players/${id}/sessions`,
      query,
    );
    return response.data;
  },

  /**
   * Get all tickets for a player
   *
   * @param id - Discord ID or Minecraft UUID
   * @param query - Query parameters for pagination
   * @returns Tickets and pagination metadata
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const tickets = await adminPlayerApi.getTickets("123456789012345678", {
   *   page: 0,
   *   limit: 20
   * });
   */
  async getTickets(
    id: string,
    query?: GetPlayerTicketsQuery,
  ): Promise<GetPlayerTicketsResponse["data"]> {
    const response = await api.get<GetPlayerTicketsResponse>(
      `/api/admin/players/${id}/tickets`,
      query,
    );
    return response.data;
  },

  /**
   * Get all strikes for a player
   *
   * @param id - Discord ID or Minecraft UUID
   * @param query - Query parameters (filter for active only)
   * @returns Strikes and statistics
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * // Get all strikes
   * const strikes = await adminPlayerApi.getStrikes("123456789012345678");
   *
   * @example
   * // Get only active strikes
   * const strikes = await adminPlayerApi.getStrikes("123456789012345678", {
   *   activeOnly: true
   * });
   */
  async getStrikes(
    id: string,
    query?: GetPlayerStrikesQuery,
  ): Promise<GetPlayerStrikesResponse["data"]> {
    const response = await api.get<GetPlayerStrikesResponse>(
      `/api/admin/players/${id}/strikes`,
      query,
    );
    return response.data;
  },

  /**
   * Issue a strike to a player
   *
   * @param id - Discord ID or Minecraft UUID
   * @param body - Strike details (classification, description, severity, etc.)
   * @returns Issued strike data
   * @throws {Error} When the API request fails or player not found
   *
   * @example
   * const strike = await adminPlayerApi.issueStrike("123456789012345678", {
   *   classification: "griefing",
   *   description: "Destroyed another player's build",
   *   severity: 3,
   *   serverId: 1,
   *   metadata: { location: "x:100, y:64, z:200" }
   * });
   */
  async issueStrike(
    id: string,
    body: IssueStrikeBody,
  ): Promise<IssueStrikeResponse["data"]> {
    const response = await api.post<IssueStrikeResponse>(
      `/api/admin/players/${id}/strikes`,
      body,
    );
    return response.data;
  },

  /**
   * Remove/pardon a strike
   *
   * @param id - Discord ID or Minecraft UUID
   * @param strikeId - Strike ID to remove
   * @param body - Removal reason
   * @returns Removed strike data
   * @throws {Error} When the API request fails or strike not found
   *
   * @example
   * const strike = await adminPlayerApi.removeStrike(
   *   "123456789012345678",
   *   42,
   *   { reason: "Strike issued in error" }
   * );
   */
  async removeStrike(
    id: string,
    strikeId: number,
    body: RemoveStrikeBody,
  ): Promise<RemoveStrikeResponse["data"]> {
    const response = await api.delete<RemoveStrikeResponse>(
      `/api/admin/players/${id}/strikes/${strikeId}`,
      body,
    );
    return response.data;
  },

  /**
   * Get overall player statistics for admin dashboard
   *
   * @returns Player statistics (total, online, registered counts, balance stats)
   * @throws {Error} When the API request fails
   *
   * @example
   * const stats = await adminPlayerApi.getStats();
   */
  async getStats(): Promise<GetAdminPlayerStatsResponse["data"]> {
    const response = await api.get<GetAdminPlayerStatsResponse>(
      "/api/admin/players/stats",
    );
    return response.data;
  },

  /**
   * Bulk balance adjustment for multiple players
   *
   * @param body - Player UUIDs, amount, and reason
   * @returns Results for each player and summary
   * @throws {Error} When the API request fails
   *
   * @example
   * const result = await adminPlayerApi.bulkBalanceAdjust({
   *   playerUuids: [
   *     "550e8400-e29b-41d4-a716-446655440000",
   *     "550e8400-e29b-41d4-a716-446655440001"
   *   ],
   *   amount: 500,
   *   reason: "Event participation reward"
   * });
   */
  async bulkBalanceAdjust(
    body: BulkBalanceAdjustBody,
  ): Promise<BulkBalanceAdjustResponse["data"]> {
    const response = await api.post<BulkBalanceAdjustResponse>(
      "/api/admin/players/bulk/balance",
      body,
    );
    return response.data;
  },
};
