import type { Request, Response } from "express";
import { getService } from "@/services";
import { Services } from "@/services/container";

/**
 * Donation controller
 *
 * Handles inbound Stripe webhook events.
 * The raw request body must be preserved as a Buffer so Stripe can verify
 * the signature — do NOT use express.json() middleware on this route.
 */
export class DonationController {
  /**
   * POST /api/donations/webhook
   *
   * Stripe sends signed webhook events here.
   * Verifies the signature, then delegates to DonationService.
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      logger.warn(`Stripe webhook signature verification failed: ${message}`);
      res.status(400).json({ error: `Webhook error: ${message}` });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await donationService.handleSessionCompleted(
            event.data.object,
          );
          break;

        case "customer.subscription.deleted":
          await donationService.handleSubscriptionDeleted(
            event.data.object,
          );
          break;

        default:
          logger.debug(`Unhandled Stripe event: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      logger.error(`Error handling Stripe event ${event.type}:`, err);
      res.status(500).json({ error: "Internal error processing webhook" });
    }
  }
}
