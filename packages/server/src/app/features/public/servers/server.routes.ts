import { route, validate } from "@/app/middleware";
import { Router } from "express";
import { ServerController } from "./server.controller";
import { GetServerParamsSchema } from "@createrington/shared/api/public/servers";

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
router.get(
  "/",
  ...route(
    "public",
    validate({ params: GetServerParamsSchema }),
    ServerController.getAll,
  ),
);

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
router.get("/:id", ...route("public", ServerController.get));

export default router;
