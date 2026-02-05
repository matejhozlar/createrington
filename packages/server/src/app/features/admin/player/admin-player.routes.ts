import { AuthLevel, route } from "@/app/middleware";
import { Router } from "express";
import { AdminPlayerController } from "./admin-player.controller";

const router = Router();

/**
 * Admin Player routes
 * Base path: /api/admin/players
 *
 * All routes require ADMIN authentication level
 */

// ============================================================================
// STATISTICS (before :id routes to avoid path conflicts)
// ============================================================================

/**
 * GET /api/admin/players/stats
 *
 * Get overall player statistics
 *
 * Response: GetAdminPlayerStatsResponse
 */
router.get("/stats", ...route(AuthLevel.ADMIN, AdminPlayerController.getStats));

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/admin/players/bulk/balance
 *
 * Bulk balance adjustment for multiple players
 *
 * Body:
 * {
 *   playerUuids: string[],
 *   amount: number,
 *   reason: string
 * }
 *
 * Response: BulkBalanceAdjustResponse
 */
router.post(
  "/bulk/balance",
  ...route(AuthLevel.ADMIN, AdminPlayerController.bulkBalanceAdjust),
);

// ============================================================================
// PLAYER LIST
// ============================================================================

/**
 * GET /api/admin/players
 *
 * Get list of players with enhanced admin data
 *
 * Query Parameters:
 * - discord_id: Filter by Discord ID
 * - minecraft_uuid: Filter by Minecraft UUID
 * - minecraft_username: Filter by username (case-insensitive partial match)
 * - online: Filter by online status (true/false)
 * - page: Page number (0-indexed, default: 0)
 * - limit: Results per page (1-100, default: 20)
 * - sort_by: Field to sort by (createdAt, minecraftUsername, updatedAt, lastSeen)
 * - sort_order: Sort direction (asc/desc, default: desc)
 * - includeStrikeCounts: Include active strike counts (true/false, default: false)
 * - includeBanCounts: Include active ban counts (true/false, default: false)
 *
 * Response: GetAdminPlayersResponse
 */
router.get("/", ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayers));

// ============================================================================
// INDIVIDUAL PLAYER OPERATIONS
// ============================================================================

/**
 * GET /api/admin/players/:id
 *
 * Get detailed player information for admin panel
 *
 * Path Parameters:
 * - id: Discord ID (17-20 digits) or Minecraft UUID (UUID format)
 *
 * Response: GetAdminPlayerResponse
 */
router.get("/:id", ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayer));

/**
 * PATCH /api/admin/players/:id
 *
 * Update player data
 *
 * Path Parameters:
 * - id: Discord ID or Minecraft UUID
 *
 * Body:
 * {
 *   minecraftUsername?: string,
 *   discordId?: string,
 *   reason: string
 * }
 *
 * Response: UpdateAdminPlayerResponse
 */
router.patch(
  "/:id",
  ...route(AuthLevel.ADMIN, AdminPlayerController.updatePlayer),
);

/**
 * DELETE /api/admin/players/:id
 *
 * Completely delete a player and all associated data
 *
 * Path Parameters:
 * - id: Discord ID or Minecraft UUID
 *
 * Body:
 * {
 *   reason: string
 * }
 *
 * Response: { success: true, message: string }
 */
router.delete(
  "/:id",
  ...route(AuthLevel.ADMIN, AdminPlayerController.deletePlayer),
);

// ============================================================================
// PLAYER SUB-RESOURCES
// ============================================================================

/**
 * GET /api/admin/players/:id/balance
 *
 * Get player balance with recent transactions
 *
 * Query Parameters:
 * - limit: Number of recent transactions (default: 10, max: 100)
 *
 * Response: GetPlayerBalanceResponse
 */
router.get(
  "/:id/balance",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerBalance),
);

/**
 * POST /api/admin/players/:id/balance/adjust
 *
 * Adjust player balance (add or subtract)
 *
 * Body:
 * {
 *   amount: number,     // Positive to add, negative to subtract
 *   reason: string
 * }
 *
 * Response: AdjustPlayerBalanceResponse
 */
router.post(
  "/:id/balance/adjust",
  ...route(AuthLevel.ADMIN, AdminPlayerController.adjustPlayerBalance),
);

/**
 * GET /api/admin/players/:id/audit-log
 *
 * Get admin action audit log for a player
 *
 * Query Parameters:
 * - limit: Number of actions (default: 50, max: 200)
 *
 * Response: GetPlayerAuditLogResponse
 */
router.get(
  "/:id/audit-log",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerAuditLog),
);

/**
 * GET /api/admin/players/:id/playtime
 *
 * Get player playtime statistics
 *
 * Response: GetPlayerPlaytimeResponse
 */
router.get(
  "/:id/playtime",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerPlaytime),
);

/**
 * GET /api/admin/players/:id/sessions
 *
 * Get player session history
 *
 * Query Parameters:
 * - server_id: Filter by server ID
 * - limit: Number of sessions (default: 50, max: 200)
 *
 * Response: GetPlayerSessionsResponse
 */
router.get(
  "/:id/sessions",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerSessions),
);

/**
 * GET /api/admin/players/:id/tickets
 *
 * Get all tickets for a player
 *
 * Response: GetPlayerTicketsResponse
 */
router.get(
  "/:id/tickets",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerTickets),
);

/**
 * GET /api/admin/players/:id/strikes
 *
 * Get all strikes for a player
 */
router.get(
  "/:id/strikes",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerStrikes),
);

/**
 * POST /api/admin/players/:id/strikes
 *
 * Issue a strike to a player
 */
router.post(
  "/:id/strikes",
  ...route(AuthLevel.ADMIN, AdminPlayerController.issueStrike),
);

/**
 * DELETE /api/admin/players/:id/strikes/:strikeId
 *
 * Remove/pardon a strike
 */
router.delete(
  "/:id/strikes/:strikeId",
  ...route(AuthLevel.ADMIN, AdminPlayerController.removeStrike),
);

// ============================================================================
// BAN OPERATIONS
// ============================================================================

/**
 * GET /api/admin/players/:id/bans
 *
 * Get all bans for a player
 *
 * Query Parameters:
 * - includeUnbanned: Include unbanned entries (true/false, default: false)
 *
 * Response: GetPlayerBansResponse
 */
router.get(
  "/:id/bans",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getPlayerBans),
);

/**
 * POST /api/admin/players/:id/bans/temporary
 *
 * Issue a temporary ban to a player
 *
 * Body:
 * {
 *   reason: string,
 *   durationDays: number,  // 1-365
 *   serverId?: number,
 *   metadata?: Record<string, any>
 * }
 *
 * Response: IssueTemporaryBanResponse
 */
router.post(
  "/:id/bans/temporary",
  ...route(AuthLevel.ADMIN, AdminPlayerController.issueTemporaryBan),
);

/**
 * POST /api/admin/players/:id/bans/permanent
 *
 * Issue a permanent ban (deletes all player data)
 *
 * WARNING: This action is irreversible!
 *
 * Body:
 * {
 *   reason: string,
 *   serverId?: number,
 *   metadata?: Record<string, any>
 * }
 *
 * Response: IssuePermanentBanResponse
 */
router.post(
  "/:id/bans/permanent",
  ...route(AuthLevel.ADMIN, AdminPlayerController.issuePermanentBan),
);

// ============================================================================
// GLOBAL BAN OPERATIONS (at root /api/admin/bans)
// ============================================================================

/**
 * DELETE /api/admin/bans/:banId
 *
 * Unban/pardon a player
 *
 * Body:
 * {
 *   reason: string
 * }
 *
 * Response: UnbanResponse
 */
router.delete(
  "/bans/:banId",
  ...route(AuthLevel.ADMIN, AdminPlayerController.unbanPlayer),
);

/**
 * GET /api/admin/bans/recent
 *
 * Get recent bans across all players
 *
 * Query Parameters:
 * - limit: Number of bans (default: 50, max: 200)
 * - activeOnly: Only active bans (default: true)
 *
 * Response: GetRecentBansResponse
 */
router.get(
  "/bans/recent",
  ...route(AuthLevel.ADMIN, AdminPlayerController.getRecentBans),
);

export default router;
