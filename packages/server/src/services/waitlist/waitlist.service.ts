import config from "@/config";
import { Q, waitlistRepo } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { WaitlistComponentPresets } from "@/discord/components/presets/waitlist";
import { settings } from "@/services/settings";
import { mainBot } from "@/discord/bots/main/client";
import { createVerificationChannel } from "@/discord/bots/main/registration/verification-channel";
import { BadRequestError } from "@/app/middleware/error-handler";
import type { WaitlistEntry } from "@createrington/shared/db";
import type { Guild, GuildMember, GuildTextBasedChannel } from "discord.js";

const PROMOTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Queue orchestration for the Discord-born waitlist: joining and leaving
 * the queue, slot-accounted promotion (free slots = player limit - players
 * - outstanding promotions), the 7-day promotion window that re-queues
 * no-shows, and all the Discord side effects (waiting-card renders, pings,
 * verification-channel recovery). Concurrent maintenance runs are skipped.
 */
export class WaitlistService {
  private maintenanceRunning = false;

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
    const existing = await Q.waitlist.entry.find({
      discordId: params.discordId,
    });

    if (!existing) {
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
      await waitlistRepo.updateProgressEmbed(entry.id);
      return Q.waitlist.entry.get({ id: entry.id });
    }

    if (existing.status === "expired") {
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
    const queued = await Q.waitlist.entry.findAll(
      { status: "queued" },
      { orderBy: "queuedAt", orderDirection: "asc", limit: 1000 },
    );

    const index = queued.findIndex((entry) => entry.discordId === discordId);
    return { position: index === -1 ? 0 : index + 1, total: queued.length };
  }

  /** Remove a member from the queue (Leave Waitlist button). */
  async leaveQueue(discordId: string): Promise<WaitlistEntry | null> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || (entry.status !== "queued" && entry.status !== "promoted")) {
      return entry;
    }

    await this.expireEntry(entry.id, `${entry.discordUsername} left the queue`);
    return Q.waitlist.entry.get({ id: entry.id });
  }

  /** Expire a departed member's entry and delete their verification channel. */
  async expireForDeparture(discordId: string): Promise<void> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || (entry.status !== "queued" && entry.status !== "promoted")) {
      return;
    }

    await this.expireEntry(entry.id, `${entry.discordUsername} left the guild`);

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
   * Promote an entry: reserve a slot, swap the waiting card for the
   * register card, and ping the member in their verification channel.
   * Pass null as promotedBy for automatic promotion.
   */
  async promote(
    entryId: number,
    promotedBy: string | null,
  ): Promise<WaitlistEntry> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    const member = await this.fetchMember(entry.discordId);
    if (!member) {
      await this.expireEntry(entry.id, "member is no longer in the guild");
      throw new BadRequestError(
        "This member is no longer in the Discord server; the entry has been expired.",
      );
    }

    await Q.waitlist.entry.update(
      { id: entry.id },
      { status: "promoted", promotedAt: new Date(), promotedBy },
    );

    await this.renderRegisterCard(entry, member);
    await waitlistRepo.updateProgressEmbed(entry.id);

    logger.info(
      `Promoted waitlist entry #${entry.id} (${entry.discordUsername})${promotedBy ? ` by admin ${promotedBy}` : " automatically"}`,
    );

    return Q.waitlist.entry.get({ id: entry.id });
  }

  private async renderRegisterCard(
    entry: WaitlistEntry,
    member: GuildMember,
  ): Promise<void> {
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
        return;
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
  }

  /** Promote the oldest queued entries into any free slots; no-op while intake is closed. */
  async promoteEligible(): Promise<number> {
    const intakeMode = await settings.getIntakeMode();
    if (intakeMode === "closed") return 0;

    const [playerCount, playerLimit, outstanding] = await Promise.all([
      Q.player.count(),
      settings.getPlayerLimit(),
      Q.waitlist.entry.count({ status: "promoted" }),
    ]);

    let free = playerLimit - playerCount - outstanding;
    if (free <= 0) return 0;

    const queued = await Q.waitlist.entry.findAll(
      { status: "queued" },
      { orderBy: "queuedAt", orderDirection: "asc", limit: 100 },
    );

    let promoted = 0;
    for (const entry of queued) {
      if (free <= 0) break;
      try {
        await this.promote(entry.id, null);
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
    await waitlistRepo.updateProgressEmbed(entry.id);
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
