import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { ForceloadsController } from "./forceloads.controller";

const router = Router();

/**
 * Forceloads routes
 * Base path: /api/forceloads
 *
 * These endpoints are called by the opac-teams Minecraft mod to sync
 * forceloadable chunks and party state for the originating server.
 */

// ============================================================================
// MOD ROUTES (JWT + IP verification required)
// ============================================================================

/**
 * POST /api/forceloads/sync
 *
 * Full-state sync of forceloadable chunks. Replaces the stored forceload
 * state for the given serverId.
 *
 * Security:
 * - Requires valid mod JWT token
 * - Requires whitelisted server IP
 */
router.post(
  "/sync",
  ...customRoute([verifyServerIP, verifyModJWT], ForceloadsController.sync),
);

export default router;
