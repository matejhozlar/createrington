import { Router } from "express";
import { AuthLevel, route } from "@/app/middleware";
import { WaitlistController } from "./waitlist.controller";

const router = Router();

/**
 * Waitlist routes
 * Base path: /api/waitlist
 */

// POST /api/waitlist - Create new entry
router.post("/", ...route(AuthLevel.PUBLIC, WaitlistController.create));

export default router;
