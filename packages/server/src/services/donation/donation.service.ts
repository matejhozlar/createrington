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
        amountCents: String(opts.amountCents),
      },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    });

    logger.info(
      `Stripe checkout session created: ${session.id} for discord ${opts.discordId}`,
    );

    return { sessionId: session.id, url: session.url! };
  }

  // ==========================================================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================================================

  /**
   * Returns the user's active subscription details from Stripe,
   * or null if they have no active monthly subscription.
   */
  async getActiveSubscription(discordId: string): Promise<{
    subscriptionId: string;
    amountCents: number;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  } | null> {
    const donation = await donationRepo.findActiveSubscription(discordId);
    if (!donation?.stripeSubscriptionId) return null;

    try {
      const sub = await this.stripe.subscriptions.retrieve(
        donation.stripeSubscriptionId,
        { expand: ["latest_invoice"] },
      );

      if (sub.status === "canceled") return null;

      const periodEnd = this.getSubscriptionPeriodEnd(sub);

      return {
        subscriptionId: sub.id,
        amountCents: donation.amountCents,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    } catch {
      return null;
    }
  }

  /**
   * Cancels a user's monthly subscription at the end of the current billing
   * period. The user keeps their perks until the period ends.
   */
  async cancelSubscription(
    discordId: string,
  ): Promise<{ cancelAt: Date } | null> {
    const donation = await donationRepo.findActiveSubscription(discordId);
    if (!donation?.stripeSubscriptionId) return null;

    const sub = await this.stripe.subscriptions.update(
      donation.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );

    logger.info(
      `Subscription ${sub.id} set to cancel at period end for discord ${discordId}`,
    );

    const cancelAt = sub.cancel_at
      ? new Date(sub.cancel_at * 1000)
      : this.getSubscriptionPeriodEnd(sub);

    return { cancelAt };
  }

  /**
   * Derives the current period end from a subscription's latest invoice
   * or cancel_at timestamp. Falls back to billing_cycle_anchor + 30 days.
   */
  private getSubscriptionPeriodEnd(sub: Stripe.Subscription): Date {
    if (sub.cancel_at) {
      return new Date(sub.cancel_at * 1000);
    }

    const invoice = sub.latest_invoice;
    if (invoice && typeof invoice !== "string" && invoice.period_end) {
      return new Date(invoice.period_end * 1000);
    }

    // Fallback: approximate from billing cycle anchor
    const anchor = new Date(sub.billing_cycle_anchor * 1000);
    const now = new Date();
    while (anchor <= now) {
      anchor.setMonth(anchor.getMonth() + 1);
    }
    return anchor;
  }

  // ==========================================================================
  // WEBHOOK HANDLERS
  // ==========================================================================

  /**
   * Handles checkout.session.completed — creates the donation record
   * and grants the supporter role if possible.
   */
  async handleSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const discordId = session.metadata?.discordId;
    const type = session.metadata?.type as DonationType | undefined;
    const amountCents = Number(session.metadata?.amountCents);

    if (!discordId || !type || !amountCents) {
      logger.warn(`checkout.session.completed missing metadata: ${session.id}`);
      return;
    }

    const donation = await donationRepo.create({
      playerDiscordId: discordId,
      type,
      amountCents,
      stripeSessionId: session.id,
      stripeCustomerId: (session.customer as string) ?? undefined,
      stripeSubscriptionId: (session.subscription as string) ?? undefined,
      status: "completed",
      completedAt: new Date(),
      supporterRoleGranted: true,
    });

    logger.info(
      `Donation completed: ${session.id} — €${(donation.amountCents / 100).toFixed(2)} from discord ${discordId}`,
    );

    await this.grantSupporterRole(discordId);
  }

  /**
   * Handles customer.subscription.updated — logs cancel_at_period_end changes.
   */
  async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    if (subscription.cancel_at_period_end) {
      logger.info(
        `Stripe subscription ${subscription.id} set to cancel at period end (customer: ${subscription.customer})`,
      );
    }
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
