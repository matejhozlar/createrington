import { db, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { BadRequestError, ConflictError } from "@/app/middleware";
import { Discord } from "@/discord/constants";
import { getService, Services } from "@/services";
import config from "@/config";
import type {
  ActiveLottery,
  LotteryParticipant,
  LotteryStartResult,
  LotteryJoinResult,
  LotteryInfo,
} from "./types";

/**
 * Runs the in-memory lottery: one active round at a time, started by a host
 * and resolved after a fixed duration with a weighted random winner. Balance
 * deductions go through BalanceRepository inside a transaction with the
 * participant row, so DB failures roll the in-memory state back. Participants
 * are also persisted so `initialize()` can refund orphans after a crash.
 */
export class LotteryService {
  private activeLottery: ActiveLottery | null = null;
  private resolving = false;

  /** Refunds every participant row left in the DB by a previous crash, then clears the table. */
  async initialize(): Promise<void> {
    const orphaned = await db.lottery.participant.findAll();

    if (orphaned.length === 0) return;

    logger.warn(
      `Found ${orphaned.length} orphaned lottery participant(s), refunding...`,
    );

    for (const entry of orphaned) {
      try {
        const amount = BalanceUtils.fromStorage(entry.amount);
        await R.balanceRepo.add(
          entry.minecraftUuid,
          amount,
          "Lottery refund (server restart)",
          BalanceTransactionType.LOTTERY_REFUND,
        );
        logger.info(
          `Refunded ${BalanceUtils.formatTrimmed(entry.amount)} to ${entry.minecraftUsername}`,
        );
      } catch (error) {
        logger.error(
          `Failed to refund lottery entry for ${entry.minecraftUsername}:`,
          error,
        );
      }
    }

    await db.lottery.participant.drop();
    logger.info("Orphaned lottery entries cleared");
  }

  /**
   * Starts a new round: claims the singleton slot, deducts the host's balance,
   * persists the entry, and arms the resolution timer. Throws ConflictError if
   * a round is already running and BadRequestError if `amount` is below the
   * configured minimum.
   */
  async start(
    uuid: string,
    username: string,
    amount: number,
  ): Promise<LotteryStartResult> {
    if (this.activeLottery) {
      throw new ConflictError("A lottery is already in progress");
    }

    const { minAmount } = config.economy.lottery;

    if (typeof amount !== "number" || amount < minAmount) {
      throw new BadRequestError(`Amount must be at least ${minAmount}`);
    }

    // Synchronously claim the slot before any await
    const endsAt = new Date(Date.now() + config.economy.lottery.durationMs);
    const participant: LotteryParticipant = {
      minecraftUuid: uuid,
      minecraftUsername: username,
      amount,
    };

    const timer = setTimeout(() => {
      this.resolve().catch((err) =>
        logger.error("Lottery resolve failed:", err),
      );
    }, config.economy.lottery.durationMs);

    this.activeLottery = {
      startedBy: participant,
      participants: [participant],
      totalPot: amount,
      startedAt: new Date(),
      timer,
    };

    try {
      await db.inTransaction(async (tx) => {
        await R.balanceRepo.deduct(
          uuid,
          amount,
          "Lottery entry",
          BalanceTransactionType.LOTTERY_ENTRY,
          undefined,
          tx,
        );

        await tx.lottery.participant.create({
          minecraftUuid: uuid,
          minecraftUsername: username,
          amount: BalanceUtils.toStorage(amount),
        });
      });
    } catch (error) {
      // Rollback in-memory state if DB operations fail
      clearTimeout(timer);
      this.activeLottery = null;
      throw error;
    }

    const message = `🎲 **Lottery Started**\nHost: **${username}**\nType \`/join <amount>\` to participate!\nWinner will be announced in 2 minutes...`;
    this.announceToDiscord(message);

    return {
      success: true,
      message: `Lottery started! Entry: $${amount}`,
      entryAmount: amount,
      endsAt,
    };
  }

  /**
   * Adds the caller to the active round, deducts their balance, and persists
   * the entry. Rolls in-memory pot back on DB failure. Throws BadRequestError
   * if no round is active or amount is non-positive, ConflictError if the
   * caller has already joined.
   */
  async join(
    uuid: string,
    username: string,
    amount: number,
  ): Promise<LotteryJoinResult> {
    if (!this.activeLottery) {
      throw new BadRequestError("No lottery is currently active");
    }

    const existing = this.activeLottery.participants.find(
      (p) => p.minecraftUuid === uuid,
    );
    if (existing) {
      throw new ConflictError("You have already joined this lottery");
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new BadRequestError("Amount must be a positive number");
    }

    // Add participant to in-memory state synchronously
    const participant: LotteryParticipant = {
      minecraftUuid: uuid,
      minecraftUsername: username,
      amount,
    };
    this.activeLottery.participants.push(participant);
    this.activeLottery.totalPot += amount;

    try {
      await db.inTransaction(async (tx) => {
        await R.balanceRepo.deduct(
          uuid,
          amount,
          "Lottery entry",
          BalanceTransactionType.LOTTERY_ENTRY,
          undefined,
          tx,
        );

        await tx.lottery.participant.create({
          minecraftUuid: uuid,
          minecraftUsername: username,
          amount: BalanceUtils.toStorage(amount),
        });
      });
    } catch (error) {
      // Rollback in-memory state if DB operations fail
      const idx = this.activeLottery.participants.indexOf(participant);
      if (idx !== -1) {
        this.activeLottery.participants.splice(idx, 1);
        this.activeLottery.totalPot -= amount;
      }
      throw error;
    }

    return {
      success: true,
      message: `Joined the lottery with $${amount}`,
      entryAmount: amount,
      totalPot: this.activeLottery.totalPot,
      participantCount: this.activeLottery.participants.length,
    };
  }

  /** Returns whether a lottery is currently active */
  isActive(): boolean {
    return this.activeLottery !== null;
  }

  /** Returns info about the current lottery, or null if none is active */
  getInfo(): LotteryInfo | null {
    if (!this.activeLottery) return null;

    return {
      totalPot: this.activeLottery.totalPot,
      participantCount: this.activeLottery.participants.length,
      startedAt: this.activeLottery.startedAt,
      endsAt: new Date(
        this.activeLottery.startedAt.getTime() +
          config.economy.lottery.durationMs,
      ),
      participants: [...this.activeLottery.participants],
    };
  }

  // `resolving` guards against concurrent timer + manual triggers.
  private async resolve(): Promise<void> {
    if (this.resolving || !this.activeLottery) return;
    this.resolving = true;

    try {
      const { participants, totalPot } = this.activeLottery;

      if (participants.length < 2) {
        // Solo entrant: refund
        const solo = participants[0];
        await R.balanceRepo.add(
          solo.minecraftUuid,
          solo.amount,
          "Lottery cancelled (not enough participants)",
          BalanceTransactionType.LOTTERY_REFUND,
        );

        const message = `❌ **Lottery Canceled**\nOnly one participant (**${solo.minecraftUsername}**) joined.\n💸 Entry fee of $${solo.amount.toLocaleString()} has been refunded.`;
        this.announceToDiscord(message);

        logger.info(
          `Lottery cancelled, refunded ${solo.minecraftUsername} $${solo.amount}`,
        );
      } else {
        const winner = this.pickWeightedWinner(participants);

        await R.balanceRepo.add(
          winner.minecraftUuid,
          totalPot,
          `Lottery win (${participants.length} participants)`,
          BalanceTransactionType.LOTTERY_WIN,
          {
            participants: participants.map((p) => ({
              uuid: p.minecraftUuid,
              username: p.minecraftUsername,
              amount: p.amount,
            })),
          },
        );

        const message = `🏆 **Lottery Winner**\nWinner: **${winner.minecraftUsername}**\nPrize: **$${totalPot.toLocaleString()}**\nGG! 🎉`;
        this.announceToDiscord(message);

        logger.info(
          `Lottery won by ${winner.minecraftUsername}, pot: $${totalPot}`,
        );
      }

      await db.lottery.participant.drop();
    } catch (error) {
      logger.error("Lottery resolution error:", error);
    } finally {
      this.activeLottery = null;
      this.resolving = false;
    }
  }

  private pickWeightedWinner(
    participants: LotteryParticipant[],
  ): LotteryParticipant {
    const totalWeight = participants.reduce((sum, p) => sum + p.amount, 0);
    let random = Math.random() * totalWeight;

    for (const participant of participants) {
      random -= participant.amount;
      if (random <= 0) {
        return participant;
      }
    }

    // Fallback (should not happen)
    return participants[participants.length - 1];
  }

  private announceToDiscord(message: string): void {
    getService(Services.WEB_MESSAGE_SERVICE)
      .then((webMessages) =>
        webMessages.send({
          channelId: Discord.Channels.cogsAndSteam.MINECRAFT_CHAT,
          content: message,
        }),
      )
      .catch((err: unknown) => {
        logger.error("Failed to announce lottery to Discord:", err);
      });
  }
}

export const lotteryService = new LotteryService();
