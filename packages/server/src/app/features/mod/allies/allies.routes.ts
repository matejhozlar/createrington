import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { AlliesController } from "./allies.controller";

const router = Router();

/**
 * Allies routes
 * Base path: /api/allies
 *
 * These endpoints are called by the opac-fakeplayer Minecraft mod to sync
 * ally state for the originating server (fake-player party, allied parties,
 * qualified players).
 */

/**
 * POST /api/allies/sync
 *
 * Full-state sync of ally data. Replaces the stored ally state for the given
 * serverId.
 *
 * Security:
 * - Requires valid mod JWT token
 * - Requires whitelisted server IP
 */
router.post(
  "/sync",
  ...customRoute([verifyServerIP, verifyModJWT], AlliesController.sync),
);

export default router;
