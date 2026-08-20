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
import {
  DiscordAPIError,
  RESTJSONErrorCodes,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

const PROMOTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROMOTION_BATCH = 100;

type MemberLookup =
  | { state: "found"; member: GuildMember }
  | { state: "gone" }
  | { state: "unavailable" };

type ChannelLookup =
  | { state: "found"; channel: GuildTextBasedChannel }
  | { state: "gone" }
  | { state: "unavailable" };

/**
 * Queue orchestration for the Discord-born waitlist: joining and leaving
 * the queue, slot-accounted promotion (free slots = player limit - players
 * - outstanding promotions), the 7-day promotion window that re-queues
 * no-shows, and all the Discord side effects (waiting-card renders, pings,
 * verification-channel recovery). Promotion passes are serialized: a call
 * made while one is running schedules a single re-run after it finishes.
 * Concurrent maintenance runs are skipped. An entry is only expired when
 * Discord positively reports the member gone; an unreachable guild or a
 * failed lookup skips the entry until the next pass. Every slot-taking
 * write (auto promotion, direct-registration reservation) re-reads the free
 * slot count inside one in-process lock, so two writers cannot both claim
 * the last slot.
 */
export class WaitlistService {
  private maintenanceRunning = false;
  private promotionPass: Promise<number> | null = null;
  private promotionRerun = false;
  private slotLock: Promise<unknown> = Promise.resolve();

  private withSlotLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.slotLock.then(fn, fn);
    this.slotLock = run.catch(() => undefined);
    return run;
  }

  private getGuild(): Guild | null {
    return mainBot.guilds.cache.get(config.discord.guild.id) ?? null;
  }

  private async lookupMember(discordId: string): Promise<MemberLookup> {
    const guild = this.getGuild();
    if (!guild) return { state: "unavailable" };
    try {
      const member = await guild.members.fetch(discordId);
      return { state: "found", member };
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        (error.code === RESTJSONErrorCodes.UnknownMember ||
          error.code === RESTJSONErrorCodes.UnknownUser)
      ) {
        return { state: "gone" };
      }
      logger.warn(`Could not fetch guild member ${discordId}:`, error);
      return { state: "unavailable" };
    }
  }

  private async lookupChannel(
    channelId: string | null,
  ): Promise<ChannelLookup> {
    if (!channelId) return { state: "gone" };
    try {
      const channel = await mainBot.channels.fetch(channelId);
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        return { state: "found", channel };
      }
      return { state: "gone" };
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        error.code === RESTJSONErrorCodes.UnknownChannel
      ) {
        return { state: "gone" };
      }
      logger.warn(`Could not fetch channel ${channelId}:`, error);
      return { state: "unavailable" };
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

    const lookup = await this.lookupChannel(entry.verifyChannelId);
    if (lookup.state === "found") {
      try {
        await lookup.channel.delete(
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
   * Reserve a slot for a member registering directly (no queue): creates a
   * promoted entry, or flips an expired/registered one back to promoted.
   * Returns null when no free slot is left. `reserved` is false when the
   * member already held a promotion, so the caller must not release it.
   */
  async reserveForDirectRegistration(
    discordId: string,
    discordUsername: string,
  ): Promise<{ entry: WaitlistEntry; reserved: boolean } | null> {
    const result = await this.withSlotLock(
      async (): Promise<{
        entry: WaitlistEntry;
        reserved: boolean;
        created: boolean;
      } | null> => {
        let existing = await Q.waitlist.entry.find({ discordId });

        if (existing?.status === "promoted") {
          return { entry: existing, reserved: false, created: false };
        }
        if (existing?.status === "queued") {
          throw new BadRequestError(
            "Queued members are promoted in order and cannot register directly.",
          );
        }
        if (
          existing?.status === "registered" &&
          (await Q.player.exists({ discordId }))
        ) {
          throw new BadRequestError(
            "This Discord account is already registered.",
          );
        }

        if ((await waitlistRepo.getFreeSlots()) <= 0) return null;

        if (!existing) {
          try {
            const entry = await Q.waitlist.entry.createAndReturn({
              discordId,
              discordUsername,
              status: "promoted",
              promotedAt: new Date(),
            });
            return { entry, reserved: true, created: true };
          } catch (error) {
            if (!(error instanceof ConstraintViolationError)) throw error;
            existing = await Q.waitlist.entry.get({ discordId });
            if (existing.status === "promoted") {
              return { entry: existing, reserved: false, created: false };
            }
          }
        }

        await Q.waitlist.entry.update(
          { id: existing.id },
          {
            status: "promoted",
            promotedAt: new Date(),
            promotedBy: null,
            discordUsername,
            registeredAt: null,
            expiredAt: null,
          },
        );
        const entry = await Q.waitlist.entry.get({ id: existing.id });
        return { entry, reserved: true, created: false };
      },
    );

    if (!result) return null;

    if (result.created) {
      logger.info(
        `Reserved a slot for ${discordUsername} (${discordId}) registering directly as waitlist entry #${result.entry.id}`,
      );
      await this.notifyAdmins(result.entry);
    } else if (result.reserved) {
      logger.info(
        `Reserved a slot for ${discordUsername} (${discordId}) registering directly on waitlist entry #${result.entry.id}`,
      );
      await waitlistRepo.updateProgressEmbed(result.entry.id);
    }

    return { entry: result.entry, reserved: result.reserved };
  }

  /** Return a slot reserved by a direct registration attempt that failed before a player row was written. */
  async releaseReservation(entryId: number): Promise<void> {
    await this.expireEntry(
      entryId,
      "registration attempt failed before completing",
    );
    this.schedulePromotionPass();
  }

  /**
   * Promote a queued entry: reserve a slot, swap the waiting card for the
   * register card, and ping the member in their verification channel.
   * Rejects entries that are not queued. Admin promotion is deliberate, so
   * it is not bound by free slots. `notified` is false when the slot was
   * reserved but the Discord ping could not be delivered.
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

    const lookup = await this.lookupMember(entry.discordId);
    if (lookup.state === "unavailable") {
      throw new BadRequestError(
        "Could not reach Discord to verify the member. Try again in a moment.",
      );
    }
    if (lookup.state === "gone") {
      await this.expireEntry(entry.id, "member is no longer in the guild");
      throw new BadRequestError(
        "This member is no longer in the Discord server; the entry has been expired.",
      );
    }

    const { notified } = await this.promoteMember(
      entry,
      lookup.member,
      promotedBy,
      { enforceCapacity: false },
    );

    return { entry: await Q.waitlist.entry.get({ id: entry.id }), notified };
  }

  private async promoteMember(
    entry: WaitlistEntry,
    member: GuildMember,
    promotedBy: string | null,
    options: { enforceCapacity: boolean },
  ): Promise<{ reserved: boolean; notified: boolean }> {
    const reserved = await this.withSlotLock(async () => {
      if (options.enforceCapacity && (await waitlistRepo.getFreeSlots()) <= 0) {
        return false;
      }
      await Q.waitlist.entry.update(
        { id: entry.id },
        { status: "promoted", promotedAt: new Date(), promotedBy },
      );
      return true;
    });

    if (!reserved) return { reserved: false, notified: false };

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

    if (!notified) await this.alertUnnotifiedPromotion(entry);

    return { reserved: true, notified };
  }

  private async alertUnnotifiedPromotion(entry: WaitlistEntry): Promise<void> {
    try {
      await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        content: `⚠️ Waitlist entry #${entry.id} (<@${entry.discordId}>) was promoted but could not be pinged in their verification channel. They hold a reserved slot for 7 days; reach out to them or delete the entry from the admin panel to free it.`,
      });
    } catch (error) {
      logger.error(
        `Failed to alert admins about unnotified promotion #${entry.id}:`,
        error,
      );
    }
  }

  private async renderRegisterCard(
    entry: WaitlistEntry,
    member: GuildMember,
  ): Promise<boolean> {
    const card = RegistrationComponentPresets.idle({
      memberMention: `${member}`,
    });

    const lookup = await this.lookupChannel(entry.verifyChannelId);
    if (lookup.state === "unavailable") {
      throw new Error(
        `Verification channel ${entry.verifyChannelId} is unreachable`,
      );
    }

    let channel = lookup.state === "found" ? lookup.channel : null;
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
      if (this.promotionRerun) {
        this.promotionRerun = false;
        this.schedulePromotionPass();
      }
    });

    return this.promotionPass;
  }

  private async runPromotionPass(): Promise<number> {
    if (!this.getGuild()) {
      logger.warn("Skipping waitlist promotion pass: guild is not available");
      return 0;
    }

    if ((await waitlistRepo.getFreeSlots()) <= 0) return 0;

    const queued = await Q.waitlist.entry.findAll(
      { status: "queued" },
      { orderBy: "queuedAt", orderDirection: "asc", limit: PROMOTION_BATCH },
    );

    let promoted = 0;
    let expired = 0;
    let exhausted = false;
    for (const entry of queued) {
      const lookup = await this.lookupMember(entry.discordId);
      if (lookup.state === "gone") {
        await this.expireEntry(entry.id, "member is no longer in the guild");
        expired++;
        continue;
      }
      if (lookup.state === "unavailable") {
        logger.warn(
          `Skipping waitlist entry #${entry.id} during auto-promotion: member lookup unavailable`,
        );
        continue;
      }

      try {
        const { reserved } = await this.promoteMember(
          entry,
          lookup.member,
          null,
          { enforceCapacity: true },
        );
        if (!reserved) {
          exhausted = true;
          break;
        }
        promoted++;
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

    if (
      !exhausted &&
      queued.length === PROMOTION_BATCH &&
      promoted + expired > 0
    ) {
      this.promotionRerun = true;
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
      const lookup = await this.lookupMember(entry.discordId);
      if (lookup.state === "gone") {
        await this.expireEntry(
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

      const channelLookup = await this.lookupChannel(entry.verifyChannelId);
      if (channelLookup.state !== "found") continue;
      const { channel } = channelLookup;

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
    if (!this.getGuild()) {
      logger.warn("Skipping waitlist maintenance: guild is not available");
      return;
    }
    this.maintenanceRunning = true;
    try {
      await this.requeueStalePromotions();
      await this.promoteEligible();
    } finally {
      this.maintenanceRunning = false;
    }
  }
}

export const waitlistService = new WaitlistService();
