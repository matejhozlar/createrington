import { Q, waitlistRepo } from "@/db";
import { WaitlistComponentPresets } from "@/discord/components/presets/waitlist";
import { getGuild, lookupChannel, lookupMember } from "./discord-lookup";
import { expireEntry } from "./entries";
import { waitlistPromotionService } from "./promotion.service";
import { waitlistService } from "./waitlist.service";

const PROMOTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Periodic waitlist maintenance: re-queues promotions whose 7-day
 * registration window lapsed (or expires them when the member left) and
 * auto-promotes the oldest queued entries into any free slots. Runs once on
 * startup, then every hour; player deletions also trigger an immediate
 * promotion pass, so the interval is only a backstop. Depends on the main
 * bot being ready and is not registered in local dev, matching the
 * prod-only join/leave handlers that feed the queue. A pass is skipped
 * while another is running or while the guild is not in the bot cache, and
 * a stale promotion is only expired when Discord positively reports the
 * member gone.
 */
export class WaitlistCleanupService {
  private intervalId?: NodeJS.Timeout;
  private maintenanceRunning = false;
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

  /** Runs an immediate maintenance pass and schedules the hourly interval. */
  initialize(): void {
    logger.info("Initializing WaitlistCleanupService...");

    // Run once on startup to clear anything stale from downtime.
    this.runCycle().catch((error) => {
      logger.error("Initial waitlist maintenance failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.runCycle().catch((error) => {
        logger.error("Scheduled waitlist maintenance failed:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      `WaitlistCleanupService initialized (maintenance every ${this.CHECK_INTERVAL / 3600000}h)`,
    );
  }

  /** Cancels the scheduled maintenance; an in-flight pass is allowed to finish. */
  shutdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("WaitlistCleanupService stopped");
    }
  }

  private async runCycle(): Promise<void> {
    if (this.maintenanceRunning) return;
    if (!getGuild()) {
      logger.warn("Skipping waitlist maintenance: guild is not available");
      return;
    }
    this.maintenanceRunning = true;
    try {
      await this.requeueStalePromotions();
      await waitlistPromotionService.promoteEligible();
    } finally {
      this.maintenanceRunning = false;
    }
  }

  private async requeueStalePromotions(): Promise<void> {
    const cutoff = new Date(Date.now() - PROMOTION_TTL_MS);
    const stale = await Q.waitlist.entry.findAll(
      { status: "promoted", promotedAt: { $lt: cutoff } },
      { limit: 100 },
    );

    for (const entry of stale) {
      const lookup = await lookupMember(entry.discordId);
      if (lookup.state === "gone") {
        await expireEntry(
          entry.id,
          "stale promotion and member no longer in guild",
        );
        continue;
      }
      if (lookup.state === "unavailable") {
        logger.warn(
          `Skipping stale promotion #${entry.id}: member lookup unavailable`,
        );
        continue;
      }

      await Q.waitlist.entry.update(
        { id: entry.id },
        {
          status: "queued",
          queuedAt: new Date(),
          promotedAt: null,
          promotedBy: null,
        },
      );
      await waitlistRepo.updateProgressEmbed(entry.id);

      logger.info(
        `Re-queued stale promotion #${entry.id} (${entry.discordUsername})`,
      );

      const channelLookup = await lookupChannel(entry.verifyChannelId);
      if (channelLookup.state !== "found") continue;
      const { channel } = channelLookup;

      try {
        if (entry.waitingMessageId) {
          const { position, total } = await waitlistService.getQueuePosition(
            entry.discordId,
          );
          const card = WaitlistComponentPresets.waiting({
            memberMention: `<@${entry.discordId}>`,
            position,
            total,
            queuedAt: new Date(),
          });
          const waitingMessage = await channel.messages.fetch(
            entry.waitingMessageId,
          );
          await waitingMessage.edit({
            components: card.components,
            flags: card.flags,
          });
        }

        await channel.send({
          content: `⌛ <@${entry.discordId}> Your registration window expired, so the spot went to the next person in line. You're back in the queue and we'll ping you again when a spot opens.`,
        });
      } catch (error) {
        logger.warn(
          `Could not notify re-queued waitlist entry #${entry.id}:`,
          error,
        );
      }
    }
  }
}
