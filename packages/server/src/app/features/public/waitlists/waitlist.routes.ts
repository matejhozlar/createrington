import { Router } from "express";
import { route, validate } from "@/app/middleware";
import { WaitlistController } from "./waitlist.controller";
import { CreateWaitlistEntryBodySchema } from "@createrington/shared/api/public/waitlists";

const router = Router();

/**
 * Waitlist routes
 * Base path: /api/waitlists
 */

// POST /api/waitlists - Create new entry
router.post(
  "/",
  validate({ body: CreateWaitlistEntryBodySchema }),
  ...route("public", WaitlistController.create),
);

export default router;
