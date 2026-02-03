import { AuthLevel, route } from "@/app/middleware";
import { Router } from "express";
import { AdminWaitlistController } from "./admin-waitlist.controller";

const router = Router();

/**
 * Admin Waitlist routes
 * Base path: /api/admin/waitlist
 */

// GET /api/admin/waitlist - Get all entries
router.get("/", ...route(AuthLevel.ADMIN, AdminWaitlistController.getAll));

// GET /api/admin/waitlist/stats - Get statistics
router.get(
  "/stats",
  ...route(AuthLevel.ADMIN, AdminWaitlistController.getStats),
);

// GET /api/admin/waitlist/:id - Get single entry
router.get("/:id", ...route(AuthLevel.ADMIN, AdminWaitlistController.get));

// DELETE /api/admin/waitlist/:id - Delete entry
router.delete(
  "/:id",
  ...route(AuthLevel.ADMIN, AdminWaitlistController.delete),
);

export default router;
