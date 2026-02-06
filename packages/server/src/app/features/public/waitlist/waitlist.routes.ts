import { Router } from "express";
import { route } from "@/app/middleware";
import { WaitlistController } from "./waitlist.controller";

const router = Router();

/**
 * Waitlist routes
 * Base path: /api/waitlists
 */

// POST /api/waitlists - Create new entry
router.post("/", ...route("public", WaitlistController.create));

export default router;
