/**
 * Admin Waitlist API Response Types
 *
 * @packageDocumentation
 */

/**
 * Admin Waitlist API Response Types
 *
 * Type definitions for admin waitlist management endpoints
 */
import type { WaitlistEntryApiData, WaitlistStatus } from "../db";
import { DateToString } from "../types";

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Path parameters for admin waitlist endpoints
 */
export interface AdminWaitlistPathParams {
  id: string; // Waitlist entry ID
}

/**
 * Query parameters for GET /api/admin/waitlist
 */
export interface GetAdminWaitlistEntriesQuery {
  // Filtering
  status?: WaitlistStatus;
  email?: string;
  discordName?: string;
  discordId?: string;
  verified?: "true" | "false";
  registered?: "true" | "false";

  // Pagination
  page?: string;
  limit?: string;

  // Sorting
  sortBy?: "submittedAt" | "acceptedAt" | "email" | "discordName";
  sortOrder?: "asc" | "desc";
}

/**
 * Body for POST /api/admin/waitlist/:id/invite
 */
export interface InviteWaitlistEntryBody {
  reason?: string;
}

/**
 * Body for DELETE /api/admin/waitlist/:id
 */
export interface DeleteWaitlistEntryBody {
  reason: string;
}

// ============================================================================
// RESPONSE DATA TYPES
// ============================================================================

/**
 * Waitlist statistics for admin dashboard
 */
export interface AdminWaitlistStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  verified: number;
  registered: number;
  joinedMinecraft: number;
  submitted: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Response for GET /api/admin/waitlist/:id
 */
export interface GetAdminWaitlistEntryResponse {
  success: true;
  data: {
    entry: DateToString<WaitlistEntryApiData>;
  };
}

/**
 * Response for GET /api/admin/waitlist
 */
export interface GetAdminWaitlistEntriesResponse {
  success: true;
  data: {
    entries: DateToString<WaitlistEntryApiData>[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Response for POST /api/admin/waitlist/:id/invite
 */
export interface InviteWaitlistEntryResponse {
  success: true;
  data: {
    entry: DateToString<WaitlistEntryApiData>;
  };
  message: string;
}

/**
 * Response for DELETE /api/admin/waitlist/:id
 */
export interface DeleteWaitlistEntryResponse {
  success: true;
  message: string;
}

/**
 * Response for GET /api/admin/waitlist/stats
 */
export interface GetAdminWaitlistStatsResponse {
  success: true;
  data: AdminWaitlistStats;
}

/**
 * Error response for admin waitlist endpoints
 */
export interface AdminWaitlistErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}
