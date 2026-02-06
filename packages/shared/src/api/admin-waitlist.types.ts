/**
 * Admin Waitlist API Types
 *
 * Request schemas (Zod for validation) and response types for admin waitlist management endpoints
 */
import { z } from "zod";
import type { WaitlistEntryApiData } from "../db";
import type { DateToString } from "../types";
import type { PaginationMeta } from "./common";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Path parameters for GET /api/admin/waitlists/:id
 *
 * Validates the waitlist ID from the URL path
 */
export const GetWaitlistParamsSchema = z.object({
  /** Discord ID or Minecraft UUID */
  id: z.coerce.number().int().positive().min(1, "Player ID is required"),
});

/**
 * Query parameters for GET /api/admin/waitlist
 */
export const GetAdminWaitlistEntriesQuerySchema = z.object({
  // Filtering
  status: z.enum(["pending", "accepted", "declined", "completed"]).optional(),
  email: z.string().optional(),
  discordName: z.string().optional(),
  discordId: z.string().optional(),
  verified: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  registered: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),

  // Pagination
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Sorting
  orderBy: z
    .enum(["submittedAt", "acceptedAt", "email", "discordName"])
    .default("submittedAt"),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Body for POST /api/admin/waitlist/:id/invite
 */
export const InviteWaitlistEntryBodySchema = z.object({
  reason: z.string().optional(),
});

/**
 * Body for DELETE /api/admin/waitlist/:id
 */
export const DeleteWaitlistEntryBodySchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

export type GetAdminWaitlistEntriesQuery = z.infer<
  typeof GetAdminWaitlistEntriesQuerySchema
>;
export type InviteWaitlistEntryBody = z.infer<
  typeof InviteWaitlistEntryBodySchema
>;
export type DeleteWaitlistEntryBody = z.infer<
  typeof DeleteWaitlistEntryBodySchema
>;

// ============================================================================
// RESPONSE DATA TYPES (Plain TypeScript - No Validation Needed)
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
// RESPONSE TYPES (Plain TypeScript - No Validation Needed)
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
    pagination: PaginationMeta;
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
