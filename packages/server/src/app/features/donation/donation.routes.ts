import { route } from "@/app/middleware";
import { Router } from "express";
import { DonationController } from "./donation.controller";

const router = Router();

router.post("/webhook", ...route("public", DonationController.handleWebhook));

export default router;
