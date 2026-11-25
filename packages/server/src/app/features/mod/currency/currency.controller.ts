import { getAuthedPlayer, respondSuccess } from "@/app/middleware";
import { BadRequestError } from "@/errors";
import { Q, balanceRepo } from "@/db";
import { BalanceUtils } from "@/db/utils/balance";
import { dailyRewardService } from "@/services/reward/daily-reward.service";
import { formatDuration } from "@/utils/format";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";
import type { Request, Response } from "express";
import {
  hashRequest,
  parseIdempotencyKey,
  runIdempotent,
  sendOutcome,
} from "./currency.idempotency";
import { formatMoney } from "@createrington/shared/format";

const MAX_MOD_AMOUNT = 1_000_000_000_000;
const MAX_REASON_LENGTH = 200;

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

  let stored: bigint;
  try {
    stored = BalanceUtils.toStorage(value);
  } catch {
    throw new BadRequestError(
      `${name} can have at most 3 decimal places`,
      undefined,
      { playerMessage: "Amounts can have at most 3 decimal places." },
    );
  }
  if (stored <= 0n) {
    throw new BadRequestError(`${name} is too small`, undefined, {
      playerMessage: "That amount is too small.",
    });
  }
  return BalanceUtils.fromStorage(stored);
}

function parseRecipientUuid(value: unknown): string {
  if (typeof value !== "string" || !MC_UUID_REGEX.test(value)) {
    throw new BadRequestError("toUuid must be a valid UUID");
  }
  return value.toLowerCase();
}

function parseReason(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.length > MAX_REASON_LENGTH) {
    throw new BadRequestError(
      `reason must be a string of at most ${MAX_REASON_LENGTH} characters`,
    );
  }
  return value;
}

export class CurrencyController {
  static async getBalance(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);

    const balance = await balanceRepo.getAmount(uuid);

    respondSuccess(res, {
      message: `Balance retrieved for player ${name}`,
      playerMessage: `Balance: ${formatMoney(balance)}`,
      data: { balance },
    });
  }

  static async pay(req: Request, res: Response): Promise<void> {
    const {
      toUuid: rawToUuid,
      amount: rawAmount,
      idempotencyKey: rawKey,
    } = req.body as {
      toUuid?: unknown;
      amount?: unknown;
      idempotencyKey?: unknown;
    };

    if (rawToUuid == null || rawAmount == null) {
      throw new BadRequestError("toUuid and amount are required");
    }

    const toUuid = parseRecipientUuid(rawToUuid);
    const amount = parsePositiveMoney(rawAmount, "amount");
    const idempotencyKey = parseIdempotencyKey(rawKey);

    const { uuid: senderUuid } = getAuthedPlayer(req);

    const outcome = await runIdempotent(
      {
        playerUuid: senderUuid,
        key: idempotencyKey,
        requestHash: hashRequest("pay", { toUuid, amount }),
      },
      async (tx) => {
        try {
          const result = await balanceRepo.transfer(
            senderUuid,
            toUuid,
            amount,
            undefined,
            { idempotencyKey, tx },
          );

          return {
            message: `Transferred ${amount} from ${senderUuid} to ${toUuid}`,
            playerMessage: `You sent ${formatMoney(amount)}`,
            data: {
              new_sender_balance: result.senderBalance,
            },
          };
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes("Insufficient balance")) {
              throw new BadRequestError("Insufficient balance", undefined, {
                playerMessage: "You don't have enough money!",
              });
            }
            if (error.message.includes("Cannot transfer to self")) {
              throw new BadRequestError(
                "Cannot transfer to yourself",
                undefined,
                { playerMessage: "You can't pay yourself." },
              );
            }
            if (error.message.includes("exceeds maximum balance")) {
              throw new BadRequestError(
                "Would exceed the recipient's maximum balance",
                undefined,
                { playerMessage: "That player can't hold that much money." },
              );
            }
          }
          throw error;
        }
      },
    );

    sendOutcome(res, outcome);
  }

  static async deposit(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const {
      amount: rawAmount,
      reason,
      idempotencyKey: rawKey,
    } = req.body as {
      amount?: unknown;
      reason?: unknown;
      idempotencyKey?: unknown;
    };

    if (rawAmount == null) {
      throw new BadRequestError("amount is required");
    }

    const amount = parsePositiveMoney(rawAmount, "amount");
    const idempotencyKey = parseIdempotencyKey(rawKey);
    const description = parseReason(reason) || "Deposit";

    const outcome = await runIdempotent(
      {
        playerUuid: uuid,
        key: idempotencyKey,
        requestHash: hashRequest("deposit", { amount, description }),
      },
      async (tx) => {
        try {
          const newBalance = await balanceRepo.add(
            uuid,
            amount,
            description,
            "deposit",
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

  static async withdraw(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const {
      denomination: rawDenomination,
      count: rawCount,
      idempotencyKey: rawKey,
    } = req.body as {
      denomination?: unknown;
      count?: unknown;
      idempotencyKey?: unknown;
    };

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
          const newBalance = await balanceRepo.deduct(
            uuid,
            totalAmount,
            `Withdraw ${count}x${denomination}`,
            "withdraw",
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

  static async getTop(_req: Request, res: Response): Promise<void> {
    const top = await Q.player.balance.getTop(10);

    respondSuccess(res, {
      message: `Top ${top.length} players retrieved`,
      data: top,
    });
  }

  static async claimDaily(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);

    const result = await dailyRewardService.claim({ minecraftUuid: uuid });

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

  static async getHistory(req: Request, res: Response): Promise<void> {
    const { uuid, name } = getAuthedPlayer(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(
      20,
      Math.max(1, parseInt(req.query.limit as string) || 10),
    );
    const offset = (page - 1) * perPage;

    const transactions = await balanceRepo.getFormattedHistory(
      uuid,
      perPage,
      offset,
    );

    respondSuccess(res, {
      message: `History page ${page} retrieved for ${name} (${transactions.length} entries)`,
      data: {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          transactionType: tx.transactionType,
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
        page,
        hasMore: transactions.length === perPage,
      },
    });
  }
}
