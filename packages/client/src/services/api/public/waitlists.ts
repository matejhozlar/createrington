import type {
  CreateWaitlistEntryBody,
  CreateWaitlistEntryResponse,
} from "@createrington/shared/api/public/waitlists";
import type { Serialize } from "@createrington/shared/api/utils";
import { api } from "../client";

/**
 * Waitlist API endpoints
 */
export const waitlistApi = {
  /**
   * Create a new waitlist entry
   *
   * @param data - Email and Discord name
   * @returns Waitlist entry data with auto-invite info
   * @throws {Error} When the API request fails
   *
   * @example
   * const result = await waitlistApi.create({
   *   email: "user@example.com",
   *   discordName: "User#1234",
   * });
   *
   * if (result.autoInvited) {
   *   // Redirect to invite page
   *   window.location.href = result.redirectUrl;
   * } else {
   *   // Show success message
   *   console.log("Added to waitlist!");
   * }
   */
  async create(
    data: CreateWaitlistEntryBody,
  ): Promise<Serialize<CreateWaitlistEntryResponse>> {
    const response = await api.post<Serialize<CreateWaitlistEntryResponse>>(
      "/api/waitlists",
      data,
    );
    return response;
  },
};
