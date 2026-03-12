import { BadRequestError } from "@/app/middleware";
import config from "@/config";
import { R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { lotteryService } from "@/services/lottery";
import { rewardService } from "@/services/reward/reward.service";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = config.app.auth.accessToken.secret;

/**
 * Currency Controller
 *
 * Handles in-game economy operations from the Minecraft mod:
 * balance checks, payments, deposits, withdrawals, daily rewards, leaderboard
 */
export class CurrencyController {
  /**
   * POST /api/currency/login
   * Body: { uuid: string, name: string }
   *
   * Creates a short-lived JWT for subsequent currency requests.
   * Only requires server IP verification (no existing JWT needed).
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { uuid, name } = req.body;

    if (!uuid || !name) {
      throw new BadRequestError("uuid and name are required");
    }

    const token = jwt.sign({ uuid, name }, JWT_SECRET, { expiresIn: "10m" });

    res.json({ token });
  }

  /**
   * GET /api/currency/balance
   *
   * Returns the player's current balance.
   */
  static async getBalance(req: Request, res: Response): Promise<void> {
    const { uuid } = req.modAuth!;

    const balance = await R.balanceRepo.getAmount(uuid);

    res.json({ balance });
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

      res.json({
        success: true,
        new_sender_balance: result.senderBalance,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Insufficient balance")) {
          throw new BadRequestError("Insufficient balance");
        }
        if (error.message.includes("Cannot transfer to self")) {
          throw new BadRequestError("Cannot transfer to yourself");
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
    const { uuid } = req.modAuth!;
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

      res.json({ success: true, new_balance: newBalance });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("would exceed maximum balance")) {
          throw new BadRequestError("Would exceed maximum balance");
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
    const { uuid } = req.modAuth!;
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

      res.json({
        success: true,
        withdrawn: totalAmount,
        new_balance: newBalance,
        denomination,
        count,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Insufficient balance")) {
          throw new BadRequestError("Insufficient balance");
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
  static async getTop(req: Request, res: Response): Promise<void> {
    const top = await R.balanceRepo.getTop(10);

    res.json(top);
  }

  /**
   * POST /api/currency/daily
   *
   * Claims the daily reward for the authenticated player.
   */
  static async claimDaily(req: Request, res: Response): Promise<void> {
    const { uuid } = req.modAuth!;

    const result = await rewardService.daily.claim({ minecraftUuid: uuid });

    res.json(result);
  }

  // ============================================================================
  // PLACEHOLDER STUBS
  // ============================================================================

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

    res.json(result);
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

    res.json(result);
  }

  /** POST /api/currency/vote/start — not yet implemented */
  static async startVote(_req: Request, _res: Response): Promise<void> {
    throw new BadRequestError("Not implemented");
  }
}
