import Stripe from "stripe";
import { roleMention, userMention, type Client } from "discord.js";
import config from "@/config";
import { Q } from "@/db";
import { UniqueViolationError } from "@/db/utils";
import { ConflictError } from "@/errors";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { DiscordRolesNamespace as DiscordRoles } from "@/discord/constants/roles";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import type { Donation, DonationType } from "@createrington/shared/db";

const SESSION_ID_CONSTRAINT = "donation_stripe_session_id_unique";

const ENDED_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["canceled", "incomplete_expired"]);

interface LiveSubscription {
  donation: Donation;
  subscription: Stripe.Subscription;
}

function customerId(subscription: Stripe.Subscription): string {
  const { customer } = subscription;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Stripe-backed donation flow: creates checkout sessions for one-time and monthly
 * support tiers, processes webhook events into donation records, and manages active
 * subscriptions (status lookup, cancel-at-period-end, reactivate, MRR stats). A player
 * has at most one monthly subscription: a second monthly checkout is refused while any
 * stored subscription of theirs is still live in Stripe, and the lookup, cancel and
 * reactivate calls resolve the subscription across all of them, preferring one that is
 * still renewing. Deleting a player cancels all of their live subscriptions at once,
 * and alerts the admins about any cancellation Stripe refuses. Supporter
 * role assignment is best-effort; a missing role or absent guild member is logged but
 * does not block the donation from completing. Webhook handlers are idempotent against
 * replays via the `stripeSessionId` lookup, and its unique constraint turns a concurrent
 * duplicate delivery into a skipped replay instead of an error.
 */
export class DonationService {
  private readonly stripe: Stripe;

  constructor(private readonly discordClient: Client) {
    this.stripe = new Stripe(config.stripe.secretKey);
  }

  /** Opens a Stripe checkout session in payment or subscription mode and returns the hosted URL; throws `ConflictError` for a monthly checkout while a subscription is live. */
  async createCheckoutSession(opts: {
    discordId: string;
    type: DonationType;
    amountCents: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    const isMonthly = opts.type === "monthly";

    if (isMonthly && (await this.findLiveSubscription(opts.discordId))) {
      throw new ConflictError(
        "You already have a monthly subscription. Cancel it and wait for it to end before starting a new one.",
      );
    }

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

  /** Active monthly subscription details fetched live from Stripe, or null if there is none; throws when Stripe cannot be reached. */
  async getActiveSubscription(discordId: string): Promise<{
    subscriptionId: string;
    amountCents: number;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  } | null> {
    const live = await this.findLiveSubscription(discordId);
    if (!live) return null;

    return {
      subscriptionId: live.subscription.id,
      amountCents: live.donation.amountCents,
      currentPeriodEnd: this.getSubscriptionPeriodEnd(live.subscription),
      cancelAtPeriodEnd: live.subscription.cancel_at_period_end,
    };
  }

  /** Marks the subscription to cancel at period end; perks remain until the date returned. */
  async cancelSubscription(
    discordId: string,
  ): Promise<{ cancelAt: Date } | null> {
    const live = await this.findLiveSubscription(discordId);
    if (!live) return null;

    const sub = await this.stripe.subscriptions.update(live.subscription.id, {
      cancel_at_period_end: true,
    });

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
    const live = await this.findLiveSubscription(discordId);
    if (!live?.subscription.cancel_at_period_end) return false;

    await this.stripe.subscriptions.update(live.subscription.id, {
      cancel_at_period_end: false,
    });

    logger.info(
      `Subscription ${live.subscription.id} reactivated for discord ${discordId}`,
    );

    return true;
  }

  /** Cancels every live subscription of the player immediately (not at period end); ones Stripe refuses are logged and reported to the admins. */
  async cancelAllSubscriptions(discordId: string): Promise<void> {
    let donations: Donation[];
    try {
      donations = await Q.donation.getLatestPerSubscription(discordId);
    } catch (error) {
      logger.error(
        `Failed to look up the subscriptions of deleted player ${discordId}:`,
        error,
      );
      await this.alertUncancelledSubscriptions(discordId, null);
      return;
    }

    const failed: string[] = [];

    for (const donation of donations) {
      const subscriptionId = donation.stripeSubscriptionId!;
      try {
        const subscription = await this.retrieveSubscription(
          subscriptionId,
          discordId,
        );
        if (
          !subscription ||
          ENDED_SUBSCRIPTION_STATUSES.has(subscription.status)
        ) {
          continue;
        }

        await this.stripe.subscriptions.cancel(subscriptionId);
        logger.info(
          `Subscription ${subscriptionId} cancelled for deleted player ${discordId}`,
        );
      } catch (error) {
        logger.error(
          `Failed to cancel subscription ${subscriptionId} of deleted player ${discordId}:`,
          error,
        );
        failed.push(subscriptionId);
      }
    }

    if (failed.length > 0) {
      await this.alertUncancelledSubscriptions(discordId, failed);
    }
  }

  private async alertUncancelledSubscriptions(
    discordId: string,
    subscriptionIds: string[] | null,
  ): Promise<void> {
    const player = `${userMention(discordId)}, \`${discordId}\``;
    const embed = subscriptionIds
      ? EmbedPresets.error(
          "Subscription Still Billing",
          `A deleted player (${player}) still has a live Stripe subscription that could not be cancelled. Cancel it in the Stripe dashboard:\n${subscriptionIds.map((id) => `- \`${id}\``).join("\n")}`,
        )
      : EmbedPresets.error(
          "Subscriptions Not Checked",
          `The subscriptions of a deleted player (${player}) could not be looked up, so none were cancelled. Check the Stripe dashboard for a live subscription of theirs and cancel it.`,
        );

    try {
      await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        embeds: embed.build(),
        content: roleMention(Discord.Roles.ADMIN),
        allowedMentions: { roles: [Discord.Roles.ADMIN] },
      });
    } catch (error) {
      logger.error(
        `Failed to alert admins about uncancelled subscriptions of ${discordId}:`,
        error,
      );
    }
  }

  private async findLiveSubscription(
    discordId: string,
  ): Promise<LiveSubscription | null> {
    const donations = await Q.donation.getLatestPerSubscription(discordId);
    const resolved = await Promise.all(
      donations.map(async (donation) => {
        const subscription = await this.retrieveSubscription(
          donation.stripeSubscriptionId!,
          discordId,
        );
        return subscription &&
          !ENDED_SUBSCRIPTION_STATUSES.has(subscription.status)
          ? { donation, subscription }
          : null;
      }),
    );
    const live = resolved.filter((entry) => entry !== null);

    return (
      live.find((entry) => !entry.subscription.cancel_at_period_end) ??
      live[0] ??
      null
    );
  }

  private async retrieveSubscription(
    subscriptionId: string,
    discordId: string,
  ): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeError &&
        error.code === "resource_missing"
      ) {
        return null;
      }
      logger.error(
        `Failed to look up Stripe subscription ${subscriptionId} for discord ${discordId}:`,
        error,
      );
      throw error;
    }
  }

  /** Live subscription stats (active, cancelling, MRR cents), matched against one paged Stripe subscription listing. */
  async getSubscriptionStats(): Promise<{
    activeCount: number;
    cancellingCount: number;
    mrrCents: number;
  }> {
    const subscriptions = await Q.donation.getLatestPerSubscription();
    const amountBySubscription = new Map(
      subscriptions.map((d) => [d.stripeSubscriptionId!, d.amountCents]),
    );

    let activeCount = 0;
    let cancellingCount = 0;
    let mrrCents = 0;

    if (amountBySubscription.size === 0) {
      return { activeCount, cancellingCount, mrrCents };
    }

    for await (const sub of this.stripe.subscriptions.list({ limit: 100 })) {
      const amountCents = amountBySubscription.get(sub.id);
      if (
        amountCents === undefined ||
        ENDED_SUBSCRIPTION_STATUSES.has(sub.status)
      )
        continue;

      if (sub.cancel_at_period_end) {
        cancellingCount++;
      } else {
        activeCount++;
        mrrCents += amountCents;
      }
    }

    return { activeCount, cancellingCount, mrrCents };
  }

  private getSubscriptionPeriodEnd(sub: Stripe.Subscription): Date {
    if (sub.cancel_at) {
      return new Date(sub.cancel_at * 1000);
    }

    const periodEnd = sub.items.data[0]?.current_period_end;
    if (periodEnd) {
      return new Date(periodEnd * 1000);
    }

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

    const existing = await Q.donation.find({ stripeSessionId: session.id });
    if (existing) {
      logger.info(
        `Stripe webhook replay for session ${session.id}, already processed, skipping`,
      );
      return;
    }

    let donation: Donation;
    try {
      donation = await Q.donation.createAndReturn({
        playerDiscordId: discordId,
        type,
        amountCents,
        stripeSessionId: session.id,
        stripeCustomerId: (session.customer as string) ?? undefined,
        stripeSubscriptionId: (session.subscription as string) ?? undefined,
        status: "completed",
        completedAt: new Date(),
      });
    } catch (error) {
      if (
        error instanceof UniqueViolationError &&
        error.constraint === SESSION_ID_CONSTRAINT
      ) {
        logger.info(
          `Stripe webhook replay for session ${session.id}, processed concurrently, skipping`,
        );
        return;
      }
      throw error;
    }

    logger.info(
      `Donation completed: ${session.id}, €${(donation.amountCents / 100).toFixed(2)} from discord ${discordId}`,
    );

    if (await this.grantSupporterRole(discordId)) {
      await Q.donation.update(
        { id: donation.id },
        { supporterRoleGranted: true },
      );
    }
  }

  /** Webhook: logs `cancel_at_period_end` transitions for audit; no state mutation. */
  handleSubscriptionUpdated(subscription: Stripe.Subscription): void {
    if (subscription.cancel_at_period_end) {
      logger.info(
        `Stripe subscription ${subscription.id} set to cancel at period end (customer: ${customerId(subscription)})`,
      );
    }
  }

  /**
   * Webhook: log-only. The supporter role is intentionally retained after cancellation
   * as a thank-you for past support, so this method does not mutate Discord state.
   */
  handleSubscriptionDeleted(subscription: Stripe.Subscription): void {
    logger.info(
      `Stripe subscription cancelled: ${subscription.id} (customer: ${customerId(subscription)})`,
    );
  }

  private async grantSupporterRole(discordId: string): Promise<boolean> {
    if (!DiscordRoles.SUPPORTER) {
      logger.warn("No 'SUPPORTER' role configured, skipping role assignment");
      return false;
    }

    try {
      const guild = this.discordClient.guilds.cache.get(
        config.discord.guild.id,
      );
      if (!guild) {
        logger.warn("Guild not in cache, cannot assign supporter role");
        return false;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        logger.warn(
          `Member ${discordId} not in guild, cannot assign supporter role`,
        );
        return false;
      }

      return await RoleManager.assign(
        member,
        DiscordRoles.SUPPORTER,
        "Donation supporter",
      );
    } catch (error) {
      logger.error(`Failed to grant supporter role to ${discordId}:`, error);
      return false;
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
