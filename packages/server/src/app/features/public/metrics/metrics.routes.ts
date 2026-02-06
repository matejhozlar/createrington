import { AuthLevel, route } from "@/app/middleware";
import { Router } from "express";
import { PlaytimeMetricsController } from "./controllers/playtime-metrics.controller";

const router = Router();

// ============================================================================
// PLAYTIME METRICS
// ============================================================================

/**
 * GET /api/metrics/playtime/hours
 * Get total hours played (server-specific or global)
 */
router.get(
  "/playtime/hours",
  ...route(AuthLevel.PUBLIC, PlaytimeMetricsController.getTotalHours),
);

/**
 * GET /api/metrics/playtime/hours/breakdown
 * Get hours breakdown by server
 */
router.get(
  "/playtime/hours/breakdown",
  ...route(AuthLevel.PUBLIC, PlaytimeMetricsController.getHoursBreakdown),
);

export default router;
