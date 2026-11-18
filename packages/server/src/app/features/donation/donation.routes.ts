import { Router } from "express";
import { DonationController } from "./donation.controller";

const router = Router();

router.post("/webhook", DonationController.handleWebhook);

export default router;
