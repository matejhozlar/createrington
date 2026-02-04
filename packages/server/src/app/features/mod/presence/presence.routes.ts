import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { PresenceController } from "./presence.controller";

const router = Router();

/**
 * Presence routes
 * Base path: /api/presence
 *
 * These endpoints are called by the Minecraft mod to report player presence
 */

// ============================================================================
// MOD ROUTES (JWT + IP verification required)
// ============================================================================

/**
 * POST /api/presence
 *
 * Update player presence (join/leave events)
 *
 * Security:
 * - Requires valid mod JWT token
 * - Requires whitelisted server IP
 *
 * Request body:
 * {
 *  minecraftUsername: string,
 *  uuid: string,
 *  state: "joined" | "left",
 *  timestamp: number,
 *  serverId?: number
 * }
 */

router.post(
  "/",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    PresenceController.updatePresence,
  ),
);

export default router;
