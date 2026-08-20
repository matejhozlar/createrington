import config from "@/config";
import { Q, waitlistRepo } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { WaitlistComponentPresets } from "@/discord/components/presets/waitlist";
import { mainBot } from "@/discord/bots/main/client";
import { createVerificationChannel } from "@/discord/bots/main/registration/verification-channel";
import { BadRequestError } from "@/app/middleware/error-handler";
import { ConstraintViolationError } from "@/db/utils/errors";
import type { WaitlistEntry } from "@createrington/shared/db";
import type { Guild, GuildMember, GuildTextBasedChannel } from "discord.js";

const PROMOTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Queue orchestration for the Discord-born waitlist: joining and leaving
 * the queue, slot-accounted promotion (free slots = player limit - players
 * - outstanding promotions), the 7-day promotion window that re-queues
 * no-shows, and all the Discord side effects (waiting-card renders, pings,
 * verification-channel recovery). Promotion passes are serialized: a call
 * made while one is running schedules a single re-run after it finishes.
 * Concurrent maintenance runs are skipped.
 */
export class WaitlistService {
  private maintenanceRunning = false;
  private promotionPass: Promise<number> | null = null;
  private promotionRerun = false;

  private getGuild(): Guild | null {
    return mainBot.guilds.cache.get(config.discord.guild.id) ?? null;
  }

  private async fetchMember(discordId: string): Promise<GuildMember | null> {
    const guild = this.getGuild();
    if (!guild) return null;
    try {
      return await guild.members.fetch(discordId);
    } catch {
      return null;
    }
  }

  private async fetchChannel(
    channelId: string | null,
  ): Promise<GuildTextBasedChannel | null> {
    if (!channelId) return null;
    try {
      const channel = await mainBot.channels.fetch(channelId);
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        return channel;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async notifyAdmins(entry: WaitlistEntry): Promise<void> {
    try {
      const { embed, components } = EmbedPresets.waitlist.queueNotification({
        id: entry.id,
        discordId: entry.discordId,
        discordUsername: entry.discordUsername,
        status: entry.status,
      });

      const result = await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        embeds: embed.setTimestamp(),
        components,
      });

      if (result.messageId) {
        await Q.waitlist.entry.update(
          { id: entry.id },
          { adminMessageId: result.messageId },
        );
      }
    } catch (error) {
      logger.error("Failed to notify admins about waitlist entry:", error);
    }
  }

  private async expireEntry(entryId: number, reason: string): Promise<void> {
    await Q.waitlist.entry.update(
      { id: entryId },
      { status: "expired", expiredAt: new Date() },
    );
    await waitlistRepo.updateProgressEmbed(entryId);
    logger.info(`Expired waitlist entry #${entryId}: ${reason}`);
  }

  private schedulePromotionPass(): void {
    void this.promoteEligible().catch((error) => {
      logger.error("Waitlist promotion pass failed:", error);
    });
  }

  /**
   * Put a member in the queue. Expired entries rejoin at the back; live
   * entries just refresh their channel/message pointers.
   */
  async joinQueue(params: {
    discordId: string;
    discordUsername: string;
    verifyChannelId: string;
    waitingMessageId: string;
  }): Promise<WaitlistEntry> {
    let existing = await Q.waitlist.entry.find({
      discordId: params.discordId,
    });

    if (!existing) {
      try {
        const entry = await Q.waitlist.entry.createAndReturn({
          discordId: params.discordId,
          discordUsername: params.discordUsername,
          verifyChannelId: params.verifyChannelId,
          waitingMessageId: params.waitingMessageId,
        });

        logger.info(
          `${params.discordUsername} (${params.discordId}) joined the waitlist as entry #${entry.id}`,
        );

        await this.notifyAdmins(entry);
        return Q.waitlist.entry.get({ id: entry.id });
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) throw error;
        existing = await Q.waitlist.entry.get({ discordId: params.discordId });
      }
    }

    const canRejoin =
      existing.status === "expired" ||
      (existing.status === "registered" &&
        !(await Q.player.exists({ discordId: params.discordId })));

    if (canRejoin) {
      await Q.waitlist.entry.update(
        { id: existing.id },
        {
          status: "queued",
          queuedAt: new Date(),
          promotedAt: null,
          promotedBy: null,
          expiredAt: null,
          discordUsername: params.discordUsername,
          verifyChannelId: params.verifyChannelId,
          waitingMessageId: params.waitingMessageId,
        },
      );

      logger.info(
        `${params.discordUsername} rejoined the waitlist (entry #${existing.id})`,
      );

      await waitlistRepo.updateProgressEmbed(existing.id);
      return Q.waitlist.entry.get({ id: existing.id });
    }

    await Q.waitlist.entry.update(
      { id: existing.id },
      {
        discordUsername: params.discordUsername,
        verifyChannelId: params.verifyChannelId,
        waitingMessageId: params.waitingMessageId,
      },
    );

    return Q.waitlist.entry.get({ id: existing.id });
  }

  /** The member's 1-based position among queued entries plus the queue length. */
  async getQueuePosition(
    discordId: string,
  ): Promise<{ position: number; total: number }> {
    const [entry, total] = await Promise.all([
      Q.waitlist.entry.find({ discordId }),
      Q.waitlist.entry.count({ status: "queued" }),
    ]);

    if (!entry || entry.status !== "queued") return { position: 0, total };

    const ahead = await Q.waitlist.entry.count({
      status: "queued",
      queuedAt: { $lt: entry.queuedAt },
    });

    return { position: ahead + 1, total };
  }

  /** Remove a member from the queue (Leave Waitlist button). */
  async leaveQueue(discordId: string): Promise<WaitlistEntry | null> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || (entry.status !== "queued" && entry.status !== "promoted")) {
      return entry;
    }

    await this.expireEntry(entry.id, `${entry.discordUsername} left the queue`);
    if (entry.status === "promoted") this.schedulePromotionPass();

    return Q.waitlist.entry.get({ id: entry.id });
  }

  /** Expire a deleted player's entry so they re-enter intake from scratch. */
  async expireForPlayerDeletion(discordId: string): Promise<void> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || entry.status === "expired") return;

    await this.expireEntry(
      entry.id,
      `${entry.discordUsername} was deleted as a player`,
    );
  }

  /** Expire a departed member's entry and delete their verification channel. */
  async expireForDeparture(discordId: string): Promise<void> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || (entry.status !== "queued" && entry.status !== "promoted")) {
      return;
    }

    await this.expireEntry(entry.id, `${entry.discordUsername} left the guild`);
    if (entry.status === "promoted") this.schedulePromotionPass();

    const channel = await this.fetchChannel(entry.verifyChannelId);
    if (channel) {
      try {
        await channel.delete(
          `Waitlist member ${entry.discordUsername} left the guild`,
        );
      } catch (error) {
        logger.warn(
          `Could not delete verification channel for entry #${entry.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Promote a queued entry: reserve a slot, swap the waiting card for the
   * register card, and ping the member in their verification channel.
   * Rejects entries that are not queued. Pass null as promotedBy for
   * automatic promotion. `notified` is false when the slot was reserved
   * but the Discord ping could not be delivered.
   */
  async promote(
    entryId: number,
    promotedBy: string | null,
  ): Promise<{ entry: WaitlistEntry; notified: boolean }> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    if (entry.status !== "queued") {
      throw new BadRequestError(
        `Only queued entries can be promoted; this entry is ${entry.status}.`,
      );
    }

    const member = await this.fetchMember(entry.discordId);
    if (!member) {
      await this.expireEntry(entry.id, "member is no longer in the guild");
      throw new BadRequestError(
        "This member is no longer in the Discord server; the entry has been expired.",
      );
    }

    const notified = await this.promoteMember(entry, member, promotedBy);

    return { entry: await Q.waitlist.entry.get({ id: entry.id }), notified };
  }

  private async promoteMember(
    entry: WaitlistEntry,
    member: GuildMember,
    promotedBy: string | null,
  ): Promise<boolean> {
    await Q.waitlist.entry.update(
      { id: entry.id },
      { status: "promoted", promotedAt: new Date(), promotedBy },
    );

    let notified = false;
    try {
      notified = await this.renderRegisterCard(entry, member);
    } catch (error) {
      logger.error(
        `Promoted waitlist entry #${entry.id} but could not notify the member:`,
        error,
      );
    }

    await waitlistRepo.updateProgressEmbed(entry.id);

    logger.info(
      `Promoted waitlist entry #${entry.id} (${entry.discordUsername})${promotedBy ? ` by admin ${promotedBy}` : " automatically"}${notified ? "" : " (member not notified)"}`,
    );

    return notified;
  }

  private async renderRegisterCard(
    entry: WaitlistEntry,
    member: GuildMember,
  ): Promise<boolean> {
    const card = RegistrationComponentPresets.idle({
      memberMention: `${member}`,
    });

    let channel = await this.fetchChannel(entry.verifyChannelId);
    let waitingMessageId = entry.waitingMessageId;

    if (!channel) {
      try {
        const joinNumber = await Q.discord.guild.member.join.recordJoin(
          entry.discordId,
          entry.discordUsername,
        );
        channel = await createVerificationChannel(member, joinNumber);
        waitingMessageId = null;
        await Q.waitlist.entry.update(
          { id: entry.id },
          { verifyChannelId: channel.id, waitingMessageId: null },
        );
      } catch (error) {
        logger.error(
          `Could not recreate verification channel for entry #${entry.id}:`,
          error,
        );
        return false;
      }
    }

    let edited = false;
    if (waitingMessageId) {
      try {
        const waitingMessage = await channel.messages.fetch(waitingMessageId);
        await waitingMessage.edit({
          components: card.components,
          flags: card.flags,
        });
        edited = true;
      } catch (error) {
        logger.warn(
          `Could not edit waiting message for entry #${entry.id}:`,
          error,
        );
      }
    }

    if (!edited) {
      const sent = await channel.send({
        components: card.components,
        flags: card.flags,
      });
      await Q.waitlist.entry.update(
        { id: entry.id },
        { waitingMessageId: sent.id },
      );
    }

    await channel.send({
      content: `🎉 <@${entry.discordId}> A spot opened up for you! Click **Register** above to claim it.`,
    });

    return true;
  }

  /**
   * Promote the oldest queued entries into any free slots; no-op while
   * intake is closed. Calls made while a pass is running share its result
   * and trigger one follow-up pass once it completes.
   */
  async promoteEligible(): Promise<number> {
    if (this.promotionPass) {
      this.promotionRerun = true;
      return this.promotionPass;
    }

    this.promotionPass = (async () => {
      let total = 0;
      do {
        this.promotionRerun = false;
        total += await this.runPromotionPass();
      } while (this.promotionRerun);
      return total;
    })().finally(() => {
      this.promotionPass = null;
    });

    return this.promotionPass;
  }

  private async runPromotionPass(): Promise<number> {
    let free = await waitlistRepo.getFreeSlots();
    if (free <= 0) return 0;

    const queued = await Q.waitlist.entry.findAll(
      { status: "queued" },
      { orderBy: "queuedAt", orderDirection: "asc", limit: 100 },
    );

    let promoted = 0;
    for (const entry of queued) {
      if (free <= 0) break;

      const member = await this.fetchMember(entry.discordId);
      if (!member) {
        await this.expireEntry(entry.id, "member is no longer in the guild");
        continue;
      }

      try {
        await this.promoteMember(entry, member, null);
        promoted++;
        free--;
      } catch (error) {
        logger.warn(
          `Skipping waitlist entry #${entry.id} during auto-promotion:`,
          error,
        );
      }
    }

    if (promoted > 0) {
      logger.info(
        `Auto-promoted ${promoted} waitlist entr${promoted === 1 ? "y" : "ies"}`,
      );
    }

    return promoted;
  }

  private async requeueStalePromotions(): Promise<void> {
    const cutoff = new Date(Date.now() - PROMOTION_TTL_MS);
    const stale = await Q.waitlist.entry.findAll(
      { status: "promoted", promotedAt: { $lt: cutoff } },
      { limit: 100 },
    );

    for (const entry of stale) {
      const member = await this.fetchMember(entry.discordId);
      if (!member) {
        await this.expireEntry(
          entry.id,
          "stale promotion and member no longer in guild",
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

      const channel = await this.fetchChannel(entry.verifyChannelId);
      if (!channel) continue;

      try {
        if (entry.waitingMessageId) {
          const { position, total } = await this.getQueuePosition(
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

  /** One maintenance pass: recycle stale promotions, then fill free slots. Concurrent runs are skipped. */
  async runMaintenance(): Promise<void> {
    if (this.maintenanceRunning) return;
    this.maintenanceRunning = true;
    try {
      await this.requeueStalePromotions();
      await this.promoteEligible();
    } finally {
      this.maintenanceRunning = false;
    }
  }

  /** Create an already-promoted entry for a member registering directly while intake is open. */
  async createPromotedForExistingMember(
    discordId: string,
    discordUsername: string,
  ): Promise<WaitlistEntry> {
    const entry = await Q.waitlist.entry.createAndReturn({
      discordId,
      discordUsername,
      status: "promoted",
      promotedAt: new Date(),
    });

    logger.info(
      `Auto-promoted existing guild member ${discordUsername} (${discordId}) as waitlist entry #${entry.id}`,
    );

    await this.notifyAdmins(entry);
    return Q.waitlist.entry.get({ id: entry.id });
  }

  /** Mark an entry registered once the registration flow completes. */
  async markRegistered(entryId: number): Promise<void> {
    await Q.waitlist.entry.update(
      { id: entryId },
      { status: "registered", registeredAt: new Date() },
    );
    await waitlistRepo.updateProgressEmbed(entryId);
  }
}

export const waitlistService = new WaitlistService();
