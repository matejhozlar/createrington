import type { Request, Response } from "express";
import { getOptionalService, Services } from "@/services";
import {
  BadRequestError,
  InternalServerError,
  ServiceUnavailableError,
} from "@/errors";

export class DonationController {
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const donationService = await getOptionalService(Services.DONATION_SERVICE);
    if (!donationService) {
      throw new ServiceUnavailableError("Donation service not configured");
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !signature) {
      throw new BadRequestError("Missing stripe-signature header");
    }

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
      throw new BadRequestError(`Webhook error: ${message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await donationService.handleSessionCompleted(event.data.object);
          break;

        case "invoice.paid":
          await donationService.handleInvoicePaid(event.data.object);
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
      throw new InternalServerError("Internal error processing webhook");
    }
  }
}
