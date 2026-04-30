import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { ChunksController } from "./chunks.controller";

const router = Router();

/**
 * Chunks routes
 * Base path: /api/chunks
 *
 * These endpoints are called by the opac-teams Minecraft mod to sync
 * all claimed chunks and their party/forceload state for the originating server.
 */

/**
 * POST /api/chunks/sync
 *
 * Full-state sync of all claimed chunks. Uses mark-and-sweep upsert to
 * handle ownership transfers, flag changes, and chunk unclaims.
 *
 * Security:
 * - Requires valid mod JWT token
 * - Requires whitelisted server IP
 */
router.post(
  "/sync",
  ...customRoute([verifyServerIP, verifyModJWT], ChunksController.sync),
);

export default router;
