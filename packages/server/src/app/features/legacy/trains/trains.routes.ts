import { customRoute, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { LegacyTrainsController } from "./trains.controller";

const router = Router();

/**
 * Legacy trains routes
 * Base path: /api/legacy/trains
 *
 * Pre-mod-JWT, pre-envelope crash endpoint for mod builds that haven't
 * migrated yet. Same path as /api/trains so the mod only needs its base
 * URL flipped via config.
 */

router.post(
  "/crash",
  ...customRoute([verifyServerIP], LegacyTrainsController.reportCrash),
);

export default router;
