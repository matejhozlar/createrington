import { BadRequestError, respondSuccess } from "@/app/middleware";
import config from "@/config";
import { Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { lotteryService } from "@/services/lottery";
import { rewardService } from "@/services/reward/reward.service";
import { formatDuration } from "@/utils/format";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = config.app.auth.accessToken.secret;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
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
   * POST /api/currency/login
   * Body: { uuid: string, name?: string }
   *
   * Creates a short-lived JWT for subsequent currency requests.
   * Only requires server IP verification (no existing JWT needed).
   *
   * `name` is optional. When omitted (e.g. from CRNet's generic login
   * strategy) it is resolved from the player record; if the player is
   * unknown, the UUID is used as a display fallback.
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { uuid, name: bodyName } = req.body;

    if (!uuid) {
      throw new BadRequestError("uuid is required");
    }

    let name: string | undefined = bodyName;
    if (!name) {
      const player = await Q.player.find({ minecraftUuid: uuid });
      name = player?.minecraftUsername ?? uuid;
    }

    const token = jwt.sign({ uuid, name }, JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "10m",
    });

    respondSuccess(res, {
      message: `Issued mod JWT for ${name}`,
      data: { token },
    });
  }

  /**
   * GET /api/currency/balance
   *
   * Returns the player's current balance.
   */
  static async getBalance(req: Request, res: Response): Promise<void> {
    const { uuid, name } = req.modAuth!;

    const balance = await R.balanceRepo.getAmount(uuid);

    respondSuccess(res, {
      message: `Balance retrieved for player ${name}`,
      playerMessage: `Balance: ${formatMoney(balance)}`,
      data: { balance },
    });
  }

  /**
   * POST /api/currency/pay
   * Body: { toUuid: string, amount: number, fromUuid?: string }
   *
   * Transfers currency between two players.
   */
  static async pay(req: Request, res: Response): Promise<void> {
    const { toUuid, amount, fromUuid } = req.body;

    if (!toUuid || amount == null) {
      throw new BadRequestError("toUuid and amount are required");
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new BadRequestError("amount must be a positive number");
    }

    const senderUuid = fromUuid || req.modAuth!.uuid;

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
   * Body: { amount: number, reason?: string }
   *
   * Adds currency to the authenticated player's balance.
   */
  static async deposit(req: Request, res: Response): Promise<void> {
    const { uuid, name } = req.modAuth!;
    const { amount, reason } = req.body;

    if (amount == null) {
      throw new BadRequestError("amount is required");
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new BadRequestError("amount must be a positive number");
    }

    try {
      const newBalance = await R.balanceRepo.add(
        uuid,
        amount,
        reason || "Deposit",
        BalanceTransactionType.DEPOSIT,
      );

      respondSuccess(res, {
        message: `Deposited ${amount} for player ${name}`,
        playerMessage: `Deposited ${formatMoney(amount)}. New balance: ${formatMoney(newBalance)}`,
        data: {
          new_balance: newBalance,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("would exceed maximum balance")) {
          throw new BadRequestError("Would exceed maximum balance", undefined, {
            playerMessage: "Deposit would exceed your maximum balance.",
          });
        }
      }
      throw error;
    }
  }

  /**
   * POST /api/currency/withdraw
   * Body: { denomination: number, count: number }
   *
   * Withdraws currency from the authenticated player's balance.
   * Total withdrawn = denomination * count.
   */
  static async withdraw(req: Request, res: Response): Promise<void> {
    const { uuid, name } = req.modAuth!;
    const { denomination, count } = req.body;

    if (denomination == null || count == null) {
      throw new BadRequestError("denomination and count are required");
    }

    if (typeof denomination !== "number" || denomination <= 0) {
      throw new BadRequestError("denomination must be a positive number");
    }

    if (typeof count !== "number" || count <= 0 || !Number.isInteger(count)) {
      throw new BadRequestError("count must be a positive integer");
    }

    const totalAmount = count * denomination;

    try {
      const newBalance = await R.balanceRepo.deduct(
        uuid,
        totalAmount,
        `Withdraw ${count}x${denomination}`,
        BalanceTransactionType.WITHDRAW,
      );

      respondSuccess(res, {
        message: `Withdrew ${totalAmount} for player ${name} (${count}x${denomination})`,
        playerMessage: `Withdrew ${formatMoney(totalAmount)}.`,
        data: {
          withdrawn: totalAmount,
          new_balance: newBalance,
          denomination,
          count,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Insufficient balance")) {
          throw new BadRequestError("Insufficient balance", undefined, {
            playerMessage: "You don't have enough money to withdraw that.",
          });
        }
      }
      throw error;
    }
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
    const { uuid, name } = req.modAuth!;

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
    const { uuid, name } = req.modAuth!;
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
    const { uuid, name } = req.modAuth!;
    const { amount } = req.body;

    if (amount == null) {
      throw new BadRequestError("amount is required");
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new BadRequestError("amount must be a positive number");
    }

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
    const { uuid, name } = req.modAuth!;
    const { amount } = req.body;

    if (amount == null) {
      throw new BadRequestError("amount is required");
    }

    if (typeof amount !== "number" || amount <= 0) {
      throw new BadRequestError("amount must be a positive number");
    }

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
