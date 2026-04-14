import { BadRequestError } from "@/app/middleware";
import config from "@/config";
import { Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { lotteryService } from "@/services/lottery";
import { rewardService } from "@/services/reward/reward.service";
import { formatDuration } from "@/utils/format";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = config.app.auth.accessToken.secret;

/**
 * Legacy Currency Controller
 *
 * Pre-envelope response shapes for the currency mod endpoints. Served under
 * /api/legacy/currency so older mod builds that parse the flat payloads
 * (balance, new_balance, etc. at the top level) keep working while the
 * current /api/currency endpoints use the ApiResponse envelope.
 *
 * Remove this once all mod clients have migrated to the envelope shape.
 */
export class LegacyCurrencyController {
  /**
   * POST /api/legacy/currency/login
   * Body: { uuid: string, name?: string }
   *
   * `name` is optional — when omitted (CRNet's generic login strategy) it
   * resolves from the player record, falling back to the uuid.
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

    res.json({ token });
  }

  static async getBalance(req: Request, res: Response): Promise<void> {
    const { uuid } = req.modAuth!;

    const balance = await R.balanceRepo.getAmount(uuid);

    res.json({ balance });
  }

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

  static async getTop(_req: Request, res: Response): Promise<void> {
    const top = await R.balanceRepo.getTop(10);

    res.json(top);
  }

  static async claimDaily(req: Request, res: Response): Promise<void> {
    const { uuid } = req.modAuth!;

    const result = await rewardService.daily.claim({ minecraftUuid: uuid });

    if (!result.success) {
      const message = result.nextClaimTime
        ? `You can claim again in ${formatDuration(new Date(), result.nextClaimTime)}`
        : (result.error ?? "Daily reward not available");

      res.status(400).json({ message });
      return;
    }

    res.json({
      message: `You claimed your daily reward of $${result.amount}!`,
    });
  }

  static async getHistory(req: Request, res: Response): Promise<void> {
    const { uuid } = req.modAuth!;
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

    res.json({
      transactions: transactions.map((tx) => ({
        ...tx,
        createdAt: tx.createdAt.toISOString(),
      })),
      page,
      hasMore: transactions.length === perPage,
    });
  }

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
}
