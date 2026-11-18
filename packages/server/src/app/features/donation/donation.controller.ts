import type { Request, Response } from "express";
import config from "@/config";
import { getService } from "@/services";
import { Services } from "@/services/container";

export class DonationController {
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    if (!config.stripe.enabled) {
      res.status(503).json({ error: "Donation service not configured" });
      return;
    }

    const signature = req.headers["stripe-signature"] as string | undefined;

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const donationService = await getService(Services.DONATION_SERVICE);

    let event;
    try {
      event = donationService.constructWebhookEvent(
        req.body as Buffer,
        signature,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid signature";
      logger.warn(`Stripe webhook signature verification failed: ${message}`);
      res.status(400).json({ error: `Webhook error: ${message}` });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await donationService.handleSessionCompleted(event.data.object);
          break;

        case "customer.subscription.updated":
          donationService.handleSubscriptionUpdated(event.data.object);
          break;

        case "customer.subscription.deleted":
          donationService.handleSubscriptionDeleted(event.data.object);
          break;

        default:
          logger.debug(`Unhandled Stripe event: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error(`Error handling Stripe event ${event.type}:`, error);
      res.status(500).json({ error: "Internal error processing webhook" });
    }
  }
}
