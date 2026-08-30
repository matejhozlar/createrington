import {
  BadRequestError,
  getAuthedPlayer,
  respondSuccess,
} from "@/app/middleware";
import { R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { lotteryService } from "@/services/lottery";
import { rewardService } from "@/services/reward/reward.service";
import { formatDuration } from "@/utils/format";
import type { Request, Response } from "express";
import {
  hashRequest,
  parseIdempotencyKey,
  runIdempotent,
  sendOutcome,
} from "./currency.idempotency";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
}

// Upper bound for any single mod-side money input. Below Number.MAX_SAFE_INTEGER
// (~9e15) and below BalanceUtils.MAX_BALANCE (~9.2e15) by enough margin that
// downstream amount * 1000 storage conversion can't lose precision or overflow.
const MAX_MOD_AMOUNT = 1_000_000_000_000;

function parsePositiveMoney(value: unknown, name: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_MOD_AMOUNT
  ) {
    throw new BadRequestError(
      `${name} must be a positive number no greater than ${MAX_MOD_AMOUNT}`,
    );
  }
  return value;
}

/**
 * Currency Controller
 *
 * Handles in-game economy operations from the Minecraft mod:
 * balance checks, payments, deposits, withdrawals, daily rewards, leaderboard
 *
 * All responses use the standard envelope: { success, message, playerMessage?, data? }
 */
export class CurrencyController {
  /**
   * GET /api/currency/balance
   *
   * Returns the player's current balance.
   */
  static async getBalance(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);

    const balance = await R.balanceRepo.getAmount(uuid);

    respondSuccess(res, {
      message: `Balance retrieved for player ${name}`,
      playerMessage: `Balance: ${formatMoney(balance)}`,
      data: { balance },
    });
  }

  /**
   * POST /api/currency/pay
   * Body: { toUuid: string, amount: number }
   *
   * Transfers currency from the authenticated player to `toUuid`. The sender
   * is always the JWT subject, any `fromUuid` in the body is ignored so a
   * caller cannot transfer from an account they don't own.
   */
  static async pay(req: Request, res: Response): Promise<void> {
    const { toUuid, amount: rawAmount } = req.body;

    if (!toUuid || rawAmount == null) {
      throw new BadRequestError("toUuid and amount are required");
    }

    const amount = parsePositiveMoney(rawAmount, "amount");

    const { uuid: senderUuid } = getAuthedPlayer(req);

    try {
      const result = await R.balanceRepo.transfer(senderUuid, toUuid, amount);

      respondSuccess(res, {
        message: `Transferred ${amount} from ${senderUuid} to ${toUuid}`,
        playerMessage: `You sent ${formatMoney(amount)}`,
        data: {
          new_sender_balance: result.senderBalance,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Insufficient balance")) {
          throw new BadRequestError("Insufficient balance", undefined, {
            playerMessage: "You don't have enough money!",
          });
        }
        if (error.message.includes("Cannot transfer to self")) {
          throw new BadRequestError("Cannot transfer to yourself", undefined, {
            playerMessage: "You can't pay yourself.",
          });
        }
      }
      throw error;
    }
  }

  /**
   * POST /api/currency/deposit
   * Body: { amount: number, reason?: string, idempotencyKey?: string }
   *
   * Adds currency to the authenticated player's balance. With an
   * idempotencyKey, a replay of the same request returns the stored response
   * without crediting again.
   */
  static async deposit(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const { amount: rawAmount, reason, idempotencyKey: rawKey } = req.body;

    if (rawAmount == null) {
      throw new BadRequestError("amount is required");
    }

    const amount = parsePositiveMoney(rawAmount, "amount");
    const idempotencyKey = parseIdempotencyKey(rawKey);
    const description = reason || "Deposit";

    const outcome = await runIdempotent(
      {
        playerUuid: uuid,
        key: idempotencyKey,
        requestHash: hashRequest("deposit", { amount, description }),
      },
      async (tx) => {
        try {
          const newBalance = await R.balanceRepo.add(
            uuid,
            amount,
            description,
            BalanceTransactionType.DEPOSIT,
            { idempotencyKey, tx },
          );

          return {
            message: `Deposited ${amount} for player ${name}`,
            playerMessage: `Deposited ${formatMoney(amount)}. New balance: ${formatMoney(newBalance)}`,
            data: {
              new_balance: newBalance,
            },
          };
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("would exceed maximum balance")
          ) {
            throw new BadRequestError(
              "Would exceed maximum balance",
              undefined,
              { playerMessage: "Deposit would exceed your maximum balance." },
            );
          }
          throw error;
        }
      },
    );

    sendOutcome(res, outcome);
  }

  /**
   * POST /api/currency/withdraw
   * Body: { denomination: number, count: number, idempotencyKey?: string }
   *
   * Withdraws currency from the authenticated player's balance.
   * Total withdrawn = denomination * count. With an idempotencyKey, a replay
   * of the same request returns the stored response without debiting again.
   */
  static async withdraw(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const {
      denomination: rawDenomination,
      count: rawCount,
      idempotencyKey: rawKey,
    } = req.body;

    if (rawDenomination == null || rawCount == null) {
      throw new BadRequestError("denomination and count are required");
    }

    const denomination = parsePositiveMoney(rawDenomination, "denomination");

    if (
      typeof rawCount !== "number" ||
      rawCount <= 0 ||
      !Number.isInteger(rawCount) ||
      rawCount > 1_000_000
    ) {
      throw new BadRequestError(
        "count must be a positive integer no greater than 1000000",
      );
    }
    const count = rawCount;

    const totalAmount = count * denomination;
    if (totalAmount > MAX_MOD_AMOUNT) {
      throw new BadRequestError(
        `total withdrawal ${totalAmount} exceeds ${MAX_MOD_AMOUNT}`,
      );
    }

    const idempotencyKey = parseIdempotencyKey(rawKey);

    const outcome = await runIdempotent(
      {
        playerUuid: uuid,
        key: idempotencyKey,
        requestHash: hashRequest("withdraw", { denomination, count }),
      },
      async (tx) => {
        try {
          const newBalance = await R.balanceRepo.deduct(
            uuid,
            totalAmount,
            `Withdraw ${count}x${denomination}`,
            BalanceTransactionType.WITHDRAW,
            { idempotencyKey, tx },
          );

          return {
            message: `Withdrew ${totalAmount} for player ${name} (${count}x${denomination})`,
            playerMessage: `Withdrew ${formatMoney(totalAmount)}.`,
            data: {
              withdrawn: totalAmount,
              new_balance: newBalance,
              denomination,
              count,
            },
          };
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("Insufficient balance")
          ) {
            throw new BadRequestError("Insufficient balance", undefined, {
              playerMessage: "You don't have enough money to withdraw that.",
            });
          }
          throw error;
        }
      },
    );

    sendOutcome(res, outcome);
  }

  /**
   * GET /api/currency/top
   *
   * Returns top 10 players by balance.
   */
  static async getTop(_req: Request, res: Response): Promise<void> {
    const top = await R.balanceRepo.getTop(10);

    respondSuccess(res, {
      message: `Top ${top.length} players retrieved`,
      data: top,
    });
  }

  /**
   * POST /api/currency/daily
   *
   * Claims the daily reward for the authenticated player.
   */
  static async claimDaily(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);

    const result = await rewardService.daily.claim({ minecraftUuid: uuid });

    if (!result.success) {
      const playerMessage = result.nextClaimTime
        ? `You can claim again in ${formatDuration(new Date(), result.nextClaimTime)}`
        : (result.error ?? "Daily reward not available");

      throw new BadRequestError(
        `Daily reward unavailable for ${name}: ${result.error ?? "cooldown"}`,
        undefined,
        { playerMessage },
      );
    }

    respondSuccess(res, {
      message: `Daily reward of ${result.amount} claimed by ${name}`,
      playerMessage: `You claimed your daily reward of ${formatMoney(result.amount ?? 0)}!`,
      data: { amount: result.amount },
    });
  }

  /**
   * GET /api/currency/history?page=1
   *
   * Returns paginated transaction history for the authenticated player.
   */
  static async getHistory(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(
      20,
      Math.max(1, parseInt(req.query.limit as string) || 10),
    );
    const offset = (page - 1) * perPage;

    const transactions = await R.balanceRepo.getFormattedHistory(
      uuid,
      perPage,
      offset,
    );

    respondSuccess(res, {
      message: `History page ${page} retrieved for ${name} (${transactions.length} entries)`,
      data: {
        transactions: transactions.map((tx) => ({
          ...tx,
          createdAt: tx.createdAt.toISOString(),
        })),
        page,
        hasMore: transactions.length === perPage,
      },
    });
  }

  /**
   * POST /api/currency/lottery/start
   * Body: { amount: number }
   *
   * Starts a new lottery round with the given buy-in amount.
   */
  static async startLottery(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const { amount: rawAmount } = req.body;

    if (rawAmount == null) {
      throw new BadRequestError("amount is required");
    }

    const amount = parsePositiveMoney(rawAmount, "amount");

    const result = await lotteryService.start(uuid, name, amount);

    respondSuccess(res, {
      message: `Lottery started by ${name} with entry ${amount}`,
      playerMessage: result.message,
      data: {
        entryAmount: result.entryAmount,
        endsAt: result.endsAt,
      },
    });
  }

  /**
   * POST /api/currency/lottery/join
   * Body: { amount: number }
   *
   * Joins an active lottery round with the given buy-in amount.
   */
  static async joinLottery(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const { amount: rawAmount } = req.body;

    if (rawAmount == null) {
      throw new BadRequestError("amount is required");
    }

    const amount = parsePositiveMoney(rawAmount, "amount");

    const result = await lotteryService.join(uuid, name, amount);

    respondSuccess(res, {
      message: `${name} joined lottery with entry ${amount}`,
      playerMessage: result.message,
      data: {
        entryAmount: result.entryAmount,
        totalPot: result.totalPot,
        participantCount: result.participantCount,
      },
    });
  }
}
