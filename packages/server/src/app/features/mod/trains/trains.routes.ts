import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { TrainsController } from "./trains.controller";

const router = Router();

/**
 * Train routes
 * Base path: /api/trains
 *
 * These endpoints are called by the Minecraft mod to report train events.
 */

// POST /api/trains/crash: report a train crash
router.post(
  "/crash",
  ...customRoute([verifyServerIP, verifyModJWT], TrainsController.reportCrash),
);

export default router;
