import { AuthLevel, route } from "@/app/middleware";
import { Router } from "express";
import { ServerController } from "./server.controller";

const router = Router();

/**
 * Server routes
 * Base path: /api/servers
 *
 * Provides real-time server status and player information
 */

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /api/servers
 *
 * Get status information for all configured servers
 *
 * Returns:
 * - Server list with online/offline status
 * - Player counts per server
 * - Active player lists
 * - Aggregate statistics
 *
 * Response: GetAllServersResponse
 */
router.get("/", ...route(AuthLevel.PUBLIC, ServerController.getAllServers));

/**
 * GET /api/servers/:id
 *
 * Get detailed status information for a specific server
 *
 * Path parameters:
 * - id: Server ID (number)
 *
 * Returns:
 * - Detailed server status
 * - Complete player list with session data
 * - Player metadata (gamemode, dimension, position, etc.)
 *
 * Response: GetServerResponse
 * Errors: 400 (invalid ID), 404 (server not found)
 */
router.get("/:id", ...route(AuthLevel.PUBLIC, ServerController.getServer));

export default router;
