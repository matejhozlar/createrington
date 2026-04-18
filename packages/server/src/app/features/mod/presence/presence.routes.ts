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

/**
 * POST /api/presence/heartbeat
 *
 * Periodic heartbeat from the mod with the full online player list.
 * Used to reconcile stale sessions from missed leave events.
 *
 * Security:
 * - Requires valid mod JWT token
 * - Requires whitelisted server IP
 *
 * Request body:
 * {
 *  players: Array<{ uuid: string, username: string }>,
 *  timestamp?: number,
 *  serverId?: string
 * }
 */
router.post(
  "/heartbeat",
  ...customRoute([verifyServerIP, verifyModJWT], PresenceController.heartbeat),
);

export default router;
