import { userMention } from "discord.js";
import { Q } from "@/db";
import { updateProgressEmbed } from "./progress-embed";
import { waitlistCapacityService } from "./capacity.service";
import { Discord } from "@/discord/constants";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { createVerificationChannel } from "@/discord/bots/main/registration/verification-channel";
import { BadRequestError } from "@/errors";
import type { WaitlistEntry } from "@createrington/shared/db";
import type { GuildMember } from "discord.js";
import { getGuild, lookupChannel, lookupMember } from "./discord-lookup";
import { expireEntry, PROMOTION_TTL_DAYS } from "./entries";
import { formatCount } from "@/utils/format";
import { withSlotLock } from "./slot-lock";

const PROMOTION_BATCH = 100;

type PromotionOutcome = "promoted" | "full" | "no-longer-queued";

/**
 * Promotion out of the waitlist queue: an admin promoting one entry, and
 * automatic passes that move the oldest queued entries into free slots,
 * with the Discord side effects (register card, ping, verification-channel
 * recovery, an admin alert when the ping fails). Passes are serialized: a
 * call made while one is running schedules a single re-run after it
 * finishes. An entry is only expired when Discord positively reports the
 * member gone; an unreachable guild or a failed lookup skips the entry
 * until the next pass. Every automatic promotion re-reads the free slot
 * count inside the slot lock that direct-registration reservations also
 * take, so two writers cannot both claim the last slot. The promotion
 * itself only applies to an entry that is still queued at that moment, so
 * one that left the queue or was promoted meanwhile is left as it is.
 */
export class WaitlistPromotionService {
  private promotionPass: Promise<number> | null = null;
  private promotionRerun = false;

  /** Starts a promotion pass in the background and logs its failure. */
  schedulePromotionPass(): void {
    void this.promoteEligible().catch((error) => {
      logger.error("Waitlist promotion pass failed:", error);
    });
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

    const lookup = await lookupMember(entry.discordId);
    if (lookup.state === "unavailable") {
      throw new BadRequestError(
        "Could not reach Discord to verify the member. Try again in a moment.",
      );
    }
    if (lookup.state === "gone") {
      await expireEntry(entry.id, "member is no longer in the guild");
      throw new BadRequestError(
        "This member is no longer in the Discord server; the entry has been expired.",
      );
    }

    const { outcome, notified } = await this.promoteMember(
      entry,
      lookup.member,
      promotedBy,
      { enforceCapacity: false },
    );
    if (outcome !== "promoted") {
      throw new BadRequestError(
        "This entry is no longer queued; it was promoted or left the queue a moment ago.",
      );
    }

    return { entry: await Q.waitlist.entry.get({ id: entry.id }), notified };
  }

  private async promoteMember(
    entry: WaitlistEntry,
    member: GuildMember,
    promotedBy: string | null,
    options: { enforceCapacity: boolean },
  ): Promise<{ outcome: PromotionOutcome; notified: boolean }> {
    const outcome = await withSlotLock(async (): Promise<PromotionOutcome> => {
      if (
        options.enforceCapacity &&
        (await waitlistCapacityService.getFreeSlots()) <= 0
      ) {
        return "full";
      }
      const promoted = await Q.waitlist.entry.updateAll(
        { status: "promoted", promotedAt: new Date(), promotedBy },
        { id: entry.id, status: "queued" },
      );
      return promoted === 0 ? "no-longer-queued" : "promoted";
    });

    if (outcome !== "promoted") return { outcome, notified: false };

    let notified = false;
    try {
      notified = await this.renderRegisterCard(entry, member);
    } catch (error) {
      logger.error(
        `Promoted waitlist entry #${entry.id} but could not notify the member:`,
        error,
      );
    }

    await updateProgressEmbed(entry.id);

    logger.info(
      `Promoted waitlist entry #${entry.id} (${entry.discordUsername})${promotedBy ? ` by admin ${promotedBy}` : " automatically"}${notified ? "" : " (member not notified)"}`,
    );

    if (!notified && promotedBy === null) {
      await this.alertUnnotifiedPromotion(entry);
    }

    return { outcome, notified };
  }

  private async alertUnnotifiedPromotion(entry: WaitlistEntry): Promise<void> {
    try {
      await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        content: `⚠️ Waitlist entry #${entry.id} (${userMention(entry.discordId)}) was promoted but could not be pinged in their verification channel. They hold a reserved slot for ${formatCount(PROMOTION_TTL_DAYS, "day")}; reach out to them or delete the entry from the admin panel to free it.`,
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

    const lookup = await lookupChannel(entry.verifyChannelId);
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
      content: `🎉 ${userMention(entry.discordId)} A spot opened up for you! Click **Register** above to claim it.`,
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
    if (!getGuild()) {
      logger.warn("Skipping waitlist promotion pass: guild is not available");
      return 0;
    }

    if ((await waitlistCapacityService.getFreeSlots()) <= 0) return 0;

    const queued = await Q.waitlist.entry.findAll(
      { status: "queued" },
      {
        orderBy: [{ field: "queuedAt" }, { field: "id" }],
        limit: PROMOTION_BATCH,
      },
    );

    let promoted = 0;
    let expired = 0;
    let exhausted = false;
    for (const entry of queued) {
      const lookup = await lookupMember(entry.discordId);
      if (lookup.state === "gone") {
        await expireEntry(entry.id, "member is no longer in the guild");
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
        const { outcome } = await this.promoteMember(
          entry,
          lookup.member,
          null,
          { enforceCapacity: true },
        );
        if (outcome === "full") {
          exhausted = true;
          break;
        }
        if (outcome === "promoted") promoted++;
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
}

export const waitlistPromotionService = new WaitlistPromotionService();
