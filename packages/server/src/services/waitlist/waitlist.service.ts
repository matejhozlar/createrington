import { Q, waitlistRepo } from "@/db";
import { BadRequestError } from "@/app/middleware/error-handler";
import { UniqueViolationError } from "@/db/utils/errors";
import type { WaitlistEntry } from "@createrington/shared/db";
import { lookupChannel } from "./discord-lookup";
import { expireEntry, notifyAdmins } from "./entries";
import { withSlotLock } from "./slot-lock";
import { waitlistPromotionService } from "./promotion.service";

type Reservation = {
  entry: WaitlistEntry;
  reserved: boolean;
  created: boolean;
};

/**
 * Queue membership for the Discord-born waitlist: joining and leaving the
 * queue, queue positions, expiring the entry of a member who left the guild
 * or was deleted as a player, and reserving a slot for a member who
 * registers directly. A reservation re-reads the free slot count (free
 * slots = player limit - players - outstanding promotions) inside the slot
 * lock that `waitlistPromotionService` also takes, so two writers cannot
 * both claim the last slot. Freeing a held promotion schedules a promotion
 * pass.
 */
export class WaitlistService {
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

        await notifyAdmins(entry);
        return Q.waitlist.entry.get({ id: entry.id });
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
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

    const [before, tied] = await Promise.all([
      Q.waitlist.entry.count({
        status: "queued",
        queuedAt: { $lt: entry.queuedAt },
      }),
      Q.waitlist.entry.count({
        status: "queued",
        queuedAt: { $eq: entry.queuedAt },
        id: { $lt: entry.id },
      }),
    ]);

    return { position: before + tied + 1, total };
  }

  /** Remove a member from the queue (Leave Waitlist button). */
  async leaveQueue(discordId: string): Promise<WaitlistEntry | null> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || (entry.status !== "queued" && entry.status !== "promoted")) {
      return entry;
    }

    await expireEntry(entry.id, `${entry.discordUsername} left the queue`);
    if (entry.status === "promoted")
      waitlistPromotionService.schedulePromotionPass();

    return Q.waitlist.entry.get({ id: entry.id });
  }

  /** Expire a deleted player's entry so they re-enter intake from scratch. */
  async expireForPlayerDeletion(discordId: string): Promise<void> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry || entry.status === "expired") return;

    await expireEntry(
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

    await expireEntry(entry.id, `${entry.discordUsername} left the guild`);
    if (entry.status === "promoted")
      waitlistPromotionService.schedulePromotionPass();

    const lookup = await lookupChannel(entry.verifyChannelId);
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
   * Pass the member's verification channel id when the registration runs
   * inside one, so departure cleanup and re-promotion can find it.
   */
  async reserveForDirectRegistration(
    discordId: string,
    discordUsername: string,
    verifyChannelId: string | null,
  ): Promise<{ entry: WaitlistEntry; reserved: boolean } | null> {
    const settle = async (
      current: WaitlistEntry,
    ): Promise<Reservation | null> => {
      if (current.status === "promoted") {
        return { entry: current, reserved: false, created: false };
      }
      if (current.status === "queued") {
        throw new BadRequestError(
          "Queued members are promoted in order and cannot register directly.",
        );
      }
      if (
        current.status === "registered" &&
        (await Q.player.exists({ discordId }))
      ) {
        throw new BadRequestError(
          "This Discord account is already registered.",
        );
      }
      return null;
    };

    const result = await withSlotLock(async (): Promise<Reservation | null> => {
      let existing = await Q.waitlist.entry.find({ discordId });
      if (existing) {
        const settled = await settle(existing);
        if (settled) return settled;
      }

      if ((await waitlistRepo.getFreeSlots()) <= 0) return null;

      if (!existing) {
        try {
          const entry = await Q.waitlist.entry.createAndReturn({
            discordId,
            discordUsername,
            status: "promoted",
            promotedAt: new Date(),
            verifyChannelId,
          });
          return { entry, reserved: true, created: true };
        } catch (error) {
          if (!(error instanceof UniqueViolationError)) throw error;
          existing = await Q.waitlist.entry.get({ discordId });
          const settled = await settle(existing);
          if (settled) return settled;
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
          ...(verifyChannelId ? { verifyChannelId } : {}),
        },
      );
      const entry = await Q.waitlist.entry.get({ id: existing.id });
      return { entry, reserved: true, created: false };
    });

    if (!result) return null;

    if (result.created) {
      logger.info(
        `Reserved a slot for ${discordUsername} (${discordId}) registering directly as waitlist entry #${result.entry.id}`,
      );
      await notifyAdmins(result.entry);
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
    await expireEntry(entryId, "registration attempt failed before completing");
    waitlistPromotionService.schedulePromotionPass();
  }
}

export const waitlistService = new WaitlistService();
