import type {
  GetAdminWaitlistEntryResponse,
  GetAdminWaitlistEntriesResponse,
  GetAdminWaitlistEntriesQuery,
  InviteWaitlistEntryResponse,
  InviteWaitlistEntryBody,
  DeleteWaitlistEntryResponse,
  DeleteWaitlistEntryBody,
  GetAdminWaitlistStatsResponse,
} from "@createrington/shared/api";
import { api } from "../client";

/**
 * Admin Waitlist API endpoints
 * All routes require ADMIN authentication level
 */
export const adminWaitlistApi = {
  /**
   * Get detailed waitlist entry information for admin panel
   *
   * @param id - Waitlist entry ID
   * @returns Detailed waitlist entry data
   * @throws {Error} When the API request fails or entry not found
   *
   * @example
   * const entry = await adminWaitlistApi.getById("123");
   */
  async getById(id: number): Promise<GetAdminWaitlistEntryResponse["data"]> {
    const response = await api.get<GetAdminWaitlistEntryResponse>(
      `/api/admin/waitlist/${id}`,
    );
    return response.data;
  },

  /**
   * Get list of waitlist entries with filtering and pagination
   *
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns Waitlist entries and pagination metadata
   * @throws {Error} When the API request fails
   *
   * @example
   * // Get first page with defaults
   * const result = await adminWaitlistApi.getAll();
   *
   * @example
   * // Get pending entries, sorted by submission date
   * const result = await adminWaitlistApi.getAll({
   *   status: "pending",
   *   orderBy: "submittedAt",
   *   orderDirection: "DESC",
   *   page: 0,
   *   limit: 50,
   * });
   *
   * @example
   * // Get verified but not registered entries
   * const result = await adminWaitlistApi.getAll({
   *   verified: true,
   *   registered: false,
   *   limit: 100,
   * });
   */
  async getAll(
    query?: Partial<GetAdminWaitlistEntriesQuery>,
  ): Promise<GetAdminWaitlistEntriesResponse["data"]> {
    const response = await api.get<GetAdminWaitlistEntriesResponse>(
      "/api/admin/waitlists",
      query,
    );
    return response.data;
  },

  /**
   * Invite a waitlist entry (accept and send invitation)
   *
   * @param id - Waitlist entry ID
   * @param body - Optional reason for invitation
   * @returns Updated waitlist entry data
   * @throws {Error} When the API request fails or entry not found
   *
   * @example
   * const entry = await adminWaitlistApi.invite("123", {
   *   reason: "Meets all requirements"
   * });
   *
   * @example
   * // Invite without reason
   * const entry = await adminWaitlistApi.invite("123", {});
   */
  async invite(
    id: number,
    body: InviteWaitlistEntryBody,
  ): Promise<InviteWaitlistEntryResponse["data"]> {
    const response = await api.post<InviteWaitlistEntryResponse>(
      `/api/admin/waitlists/${id}/invite`,
      body,
    );
    return response.data;
  },

  /**
   * Delete a waitlist entry
   *
   * @param id - Waitlist entry ID
   * @param body - Deletion reason
   * @returns Success message
   * @throws {Error} When the API request fails or entry not found
   *
   * @example
   * await adminWaitlistApi.delete("123", {
   *   reason: "Duplicate entry"
   * });
   *
   * @example
   * await adminWaitlistApi.delete("456", {
   *   reason: "Entry requested removal"
   * });
   */
  async delete(
    id: number,
    body: DeleteWaitlistEntryBody,
  ): Promise<DeleteWaitlistEntryResponse> {
    const response = await api.delete<DeleteWaitlistEntryResponse>(
      `/api/admin/waitlists/${id}`,
      body,
    );
    return response;
  },

  /**
   * Get overall waitlist statistics for admin dashboard
   *
   * @returns Waitlist statistics (total, status counts, submission stats)
   * @throws {Error} When the API request fails
   *
   * @example
   * const stats = await adminWaitlistApi.getStats();
   * console.log(`Pending entries: ${stats.pending}`);
   * console.log(`Accepted this week: ${stats.submitted.thisWeek}`);
   */
  async getStats(): Promise<GetAdminWaitlistStatsResponse["data"]> {
    const response = await api.get<GetAdminWaitlistStatsResponse>(
      "/api/admin/waitlists/stats",
    );
    return response.data;
  },
};
