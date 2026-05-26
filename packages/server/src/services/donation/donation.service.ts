import Stripe from "stripe";
import type { Client } from "discord.js";
import config from "@/config";
import { donationRepo } from "@/db";
import { DiscordRolesNamespace as DiscordRoles } from "@/discord/constants/roles";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import type { DonationType } from "@createrington/shared/db";

/**
 * Stripe-backed donation flow: creates checkout sessions for one-time and monthly
 * support tiers, processes webhook events into donation records, and manages active
 * subscriptions (status lookup, cancel-at-period-end, reactivate, MRR stats). Supporter
 * role assignment is best-effort; a missing role or absent guild member is logged but
 * does not block the donation from completing. Webhook handlers are idempotent against
 * replays via the `stripeSessionId` lookup.
 */
export class DonationService {
  private readonly stripe: Stripe;

  constructor(private readonly discordClient: Client) {
    this.stripe = new Stripe(config.stripe.secretKey);
  }

  /** Opens a Stripe checkout session in payment or subscription mode and returns the hosted URL. */
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

  /** Active monthly subscription details fetched live from Stripe, or null if there is none. */
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

  /** Marks the subscription to cancel at period end; perks remain until the date returned. */
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

  /** Clears `cancel_at_period_end` on a still-active subscription. Returns false if already ended. */
  async reactivateSubscription(discordId: string): Promise<boolean> {
    const donation = await donationRepo.findActiveSubscription(discordId);
    if (!donation?.stripeSubscriptionId) return false;

    const sub = await this.stripe.subscriptions.retrieve(
      donation.stripeSubscriptionId,
    );

    if (sub.status === "canceled" || !sub.cancel_at_period_end) return false;

    await this.stripe.subscriptions.update(donation.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    logger.info(`Subscription ${sub.id} reactivated for discord ${discordId}`);

    return true;
  }

  /** Live subscription stats (active, cancelling, MRR cents); each row is verified against Stripe. */
  async getSubscriptionStats(): Promise<{
    activeCount: number;
    cancellingCount: number;
    mrrCents: number;
  }> {
    const subscriptions = await donationRepo.findAllSubscriptions();

    let activeCount = 0;
    let cancellingCount = 0;
    let mrrCents = 0;

    await Promise.all(
      subscriptions.map(async (donation) => {
        try {
          const sub = await this.stripe.subscriptions.retrieve(
            donation.stripeSubscriptionId!,
          );

          if (sub.status === "canceled") return;

          if (sub.cancel_at_period_end) {
            cancellingCount++;
          } else {
            activeCount++;
            mrrCents += donation.amountCents;
          }
        } catch {
          // Subscription no longer exists in Stripe
        }
      }),
    );

    return { activeCount, cancellingCount, mrrCents };
  }

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

  /** Webhook: persists the donation row (idempotent on `session.id`) and grants the supporter role. */
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

    const existing = await donationRepo.findBySessionId(session.id);
    if (existing) {
      logger.info(
        `Stripe webhook replay for session ${session.id}, already processed, skipping`,
      );
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
      `Donation completed: ${session.id}, €${(donation.amountCents / 100).toFixed(2)} from discord ${discordId}`,
    );

    await this.grantSupporterRole(discordId);
  }

  /** Webhook: logs `cancel_at_period_end` transitions for audit; no state mutation. */
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
   * Webhook: log-only. The supporter role is intentionally retained after cancellation
   * as a thank-you for past support, so this method does not mutate Discord state.
   */
  async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    logger.info(
      `Stripe subscription cancelled: ${subscription.id} (customer: ${subscription.customer})`,
    );
  }

  private async grantSupporterRole(discordId: string): Promise<void> {
    if (!DiscordRoles.SUPPORTER) {
      logger.warn("No 'SUPPORTER' role configured, skipping role assignment");
      return;
    }

    try {
      const guild = this.discordClient.guilds.cache.get(
        config.discord.guild.id,
      );
      if (!guild) {
        logger.warn("Guild not in cache, cannot assign supporter role");
        return;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        logger.warn(
          `Member ${discordId} not in guild, cannot assign supporter role`,
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

  /** Verifies a Stripe webhook signature and returns the parsed event; throws on invalid signature. */
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
