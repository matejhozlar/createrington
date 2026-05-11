import { Router } from "express";
import { DonationController } from "./donation.controller";

const router = Router();

/**
 * Donation routes
 * Base path: /api/donations
 */

// POST /api/donations/webhook: Stripe webhook (raw body required for signature check)
router.post("/webhook", DonationController.handleWebhook);

export default router;
