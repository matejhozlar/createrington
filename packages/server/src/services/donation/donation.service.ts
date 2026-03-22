import Stripe from "stripe";
import type { Client } from "discord.js";
import config from "@/config";
import { donationRepo } from "@/db";
import { DiscordRolesNamespace as DiscordRoles } from "@/discord/constants/roles";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import type { DonationType } from "@createrington/shared/db";

/**
 * Donation Service
 *
 * Manages Stripe checkout session creation and post-payment processing.
 * Role assignment is best-effort — a missing or unconfigured supporter role
 * logs a warning but never blocks the donation from completing.
 */
export class DonationService {
  private readonly stripe: Stripe;

  constructor(private readonly discordClient: Client) {
    this.stripe = new Stripe(config.stripe.secretKey);
  }

  // ==========================================================================
  // CHECKOUT
  // ==========================================================================

  /**
   * Creates a Stripe checkout session and a pending donation record.
   *
   * @returns Stripe session ID and hosted checkout URL
   */
  async createCheckoutSession(opts: {
    discordId: string;
    type: DonationType;
    amountCents: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    const isMonthly = opts.type === "monthly";

    const session = await this.stripe.checkout.sessions.create({
      mode: isMonthly ? "subscription" : "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: isMonthly ? "Monthly Support" : "One-time Donation",
              description: "Support the Createrington server",
            },
            unit_amount: opts.amountCents,
            ...(isMonthly && { recurring: { interval: "month" } }),
          },
          quantity: 1,
        },
      ],
      metadata: {
        discordId: opts.discordId,
        type: opts.type,
      },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    });

    await donationRepo.create({
      playerDiscordId: opts.discordId,
      type: opts.type,
      amountCents: opts.amountCents,
      stripeSessionId: session.id,
    });

    logger.info(
      `Stripe checkout session created: ${session.id} for discord ${opts.discordId}`,
    );

    return { sessionId: session.id, url: session.url! };
  }

  // ==========================================================================
  // WEBHOOK HANDLERS
  // ==========================================================================

  /**
   * Handles checkout.session.completed — completes the donation record
   * and grants the supporter role if possible.
   */
  async handleSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const discordId = session.metadata?.discordId;
    if (!discordId) {
      logger.warn(
        `checkout.session.completed missing discordId metadata: ${session.id}`,
      );
      return;
    }

    const donation = await donationRepo.completeBySessionId(
      session.id,
      session.customer as string | undefined,
      (session.subscription as string) ?? undefined,
    );

    if (!donation) {
      logger.warn(`No pending donation found for session: ${session.id}`);
      return;
    }

    logger.info(
      `Donation completed: ${session.id} — €${(donation.amountCents / 100).toFixed(2)} from discord ${discordId}`,
    );

    await this.grantSupporterRole(discordId);
  }

  /**
   * Handles customer.subscription.deleted — currently a no-op but logged
   * so the admin can track churn. Role removal is intentionally skipped
   * as a "thank you for your support" gesture.
   */
  async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    logger.info(
      `Stripe subscription cancelled: ${subscription.id} (customer: ${subscription.customer})`,
    );
  }

  // ==========================================================================
  // ROLE ASSIGNMENT
  // ==========================================================================

  /**
   * Grants the supporter role to a Discord member.
   * Silently skips if the role is not configured or the member is not found.
   */
  private async grantSupporterRole(discordId: string): Promise<void> {
    if (!DiscordRoles.SUPPORTER) {
      logger.warn("No 'SUPPORTER' role configured — skipping role assignment");
      return;
    }

    try {
      const guild = this.discordClient.guilds.cache.get(
        config.discord.guild.id,
      );
      if (!guild) {
        logger.warn("Guild not in cache — cannot assign supporter role");
        return;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        logger.warn(
          `Member ${discordId} not in guild — cannot assign supporter role`,
        );
        return;
      }

      await RoleManager.assign(
        member,
        DiscordRoles.SUPPORTER,
        "Donation supporter",
      );
    } catch (error) {
      logger.error(`Failed to grant supporter role to ${discordId}:`, error);
    }
  }

  // ==========================================================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ==========================================================================

  /**
   * Verifies a Stripe webhook signature and returns the parsed event.
   * Throws if the signature is invalid.
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret,
    );
  }
}
