import { customRoute, verifySyncSecret } from "@/app/middleware";
import { Router } from "express";
import { InternalPresenceController } from "./presence.controller";

const router = Router();

/**
 * Internal presence routes
 * Base path: /api/internal/presence
 *
 * These endpoints receive forwarded presence events from the dev environment.
 * Authentication: X-Sync-Secret header (shared secret between environments).
 */

/**
 * POST /api/internal/presence
 *
 * Receive a forwarded player join/leave event from the dev server.
 *
 * Security:
 * - Requires valid X-Sync-Secret header
 *
 * Request body:
 * {
 *   uuid: string,
 *   username: string,
 *   state: "joined" | "left",
 *   timestamp?: string (ISO 8601)
 * }
 */
router.post(
  "/",
  ...customRoute(
    [verifySyncSecret],
    InternalPresenceController.handleSyncedPresence,
  ),
);

/**
 * POST /api/internal/presence/heartbeat
 *
 * Receive a forwarded heartbeat from the dev server containing the full
 * online player list. Reconciles test server sessions on production.
 *
 * Security:
 * - Requires valid X-Sync-Secret header
 *
 * Request body:
 * {
 *   players: Array<{ uuid: string, username: string }>,
 *   timestamp?: string (ISO 8601)
 * }
 */
router.post(
  "/heartbeat",
  ...customRoute(
    [verifySyncSecret],
    InternalPresenceController.handleSyncedHeartbeat,
  ),
);

export default router;
