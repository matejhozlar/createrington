// packages/server/src/app/features/admin/waitlist/admin-waitlist.routes.ts

import { AuthLevel, route } from "@/app/middleware";
import { Router } from "express";
import { AdminWaitlistController } from "./admin-waitlist.controller";

const router = Router();

/**
 * Admin Waitlist routes
 * Base path: /api/admin/waitlist
 *
 * All routes require ADMIN authentication level
 */

// ============================================================================
// STATISTICS (before :id routes to avoid path conflicts)
// ============================================================================

/**
 * GET /api/admin/waitlist/stats
 *
 * Get overall waitlist statistics
 *
 * Response: GetAdminWaitlistStatsResponse
 */
router.get(
  "/stats",
  ...route(AuthLevel.ADMIN, AdminWaitlistController.getStats),
);

// ============================================================================
// WAITLIST ENTRY LIST
// ============================================================================

/**
 * GET /api/admin/waitlists
 *
 * Get list of waitlist entries with filtering and pagination
 *
 * Query Parameters:
 * - status: Filter by status (pending/accepted/rejected)
 * - email: Filter by email (case-insensitive partial match)
 * - discord_name: Filter by Discord name (case-insensitive partial match)
 * - discord_id: Filter by Discord ID
 * - verified: Filter by verification status (true/false)
 * - registered: Filter by registration status (true/false)
 * - page: Page number (0-indexed, default: 0)
 * - limit: Results per page (1-100, default: 20)
 * - sort_by: Field to sort by (submittedAt, acceptedAt, email, discordName)
 * - sort_order: Sort direction (asc/desc, default: desc)
 *
 * Response: GetAdminWaitlistEntriesResponse
 */
router.get("/", ...route(AuthLevel.ADMIN, AdminWaitlistController.getEntries));

// ============================================================================
// INDIVIDUAL WAITLIST ENTRY OPERATIONS
// ============================================================================

/**
 * GET /api/admin/waitlist/:id
 *
 * Get detailed waitlist entry information
 *
 * Path Parameters:
 * - id: Waitlist entry ID
 *
 * Response: GetAdminWaitlistEntryResponse
 */
router.get("/:id", ...route(AuthLevel.ADMIN, AdminWaitlistController.getEntry));

/**
 * POST /api/admin/waitlist/:id/invite
 *
 * Manually invite a waitlist entry
 *
 * Path Parameters:
 * - id: Waitlist entry ID
 *
 * Body:
 * {
 *   reason?: string
 * }
 *
 * Response: InviteWaitlistEntryResponse
 */
router.post(
  "/:id/invite",
  ...route(AuthLevel.ADMIN, AdminWaitlistController.inviteEntry),
);

/**
 * DELETE /api/admin/waitlist/:id
 *
 * Delete a waitlist entry
 *
 * Path Parameters:
 * - id: Waitlist entry ID
 *
 * Body:
 * {
 *   reason: string
 * }
 *
 * Response: DeleteWaitlistEntryResponse
 */
router.delete(
  "/:id",
  ...route(AuthLevel.ADMIN, AdminWaitlistController.deleteEntry),
);

export default router;
