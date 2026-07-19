/**
 * Order manager for limit, stop-loss, and take-profit orders.
 * Handles creation, validation, filling, cancellation, and expiration.
 */

import { db, Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { cryptoSetting } from "../settings/accessor";
import { calculateFee } from "./fee-calculator";
import { recordCostBasisLot, consumeCostBasis } from "./cost-basis-tracker";
import { updateTreasury } from "./treasury";
import { getLifetimeTradeCount } from "./lifetime-trades";
import { getReservedTokens } from "./reservations";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import type { CryptoOrder } from "@createrington/shared/db/crypto_order.types";
import type { CryptoOrderType } from "@createrington/shared/db/database.types";

export interface OrderResult {
  orderId: number;
  tokenId: number;
  symbol: string;
  type: CryptoOrderType;
  amount: string;
  targetPrice: string;
  expiresAt: string;
}

export interface OrderFillResult {
  orderId: number;
  playerUuid: string;
  tokenId: number;
  symbol: string;
  type: CryptoOrderType;
  amount: bigint;
  filledPrice: string;
  feeAmount: number;
  totalCost: number;
  realizedPnl: number | null;
}

/**
 * Creates a new pending order with balance/token reservation.
 *
 * For limit buys, reserves the full cost (amount × targetPrice + fee) from the
 * player's balance. For sell-type orders, validates unreserved token holdings.
 * Enforces price direction constraints (e.g., limit buy must be below current price).
 * Orders of any type are blocked while the token is in its IPO phase.
 *
 * @param playerUuid - Minecraft UUID of the order placer
 * @param token - Token to trade (must not be crashed, delisted, or in IPO phase)
 * @param type - Order type (limit_buy, limit_sell, stop_loss, take_profit)
 * @param amount - Number of tokens
 * @param targetPrice - Trigger price for the order
 * @param expiryHours - Hours until auto-expiry (default: 24, max: 168)
 * @returns Order details including ID and expiry timestamp
 */
export async function placeOrder(
  playerUuid: string,
  token: CryptoToken,
  type: CryptoOrderType,
  amount: bigint,
  targetPrice: string,
  expiryHours?: number,
): Promise<OrderResult> {
  if (token.isCrashed) {
    throw new ConflictError(`Token ${token.symbol} has crashed`);
  }
  if (token.delistedAt) {
    throw new ConflictError(`Token ${token.symbol} has been delisted`);
  }
  if (token.ipoEndsAt && token.ipoEndsAt > new Date()) {
    throw new ConflictError(
      `${token.symbol} is in its IPO phase: limit/stop orders are not available until trading opens`,
    );
  }
  if (amount <= 0n) {
    throw new BadRequestError("Amount must be positive");
  }
  if (Number(targetPrice) <= 0) {
    throw new BadRequestError("Target price must be positive");
  }

  const currentPrice = Number(token.price);
  const target = Number(targetPrice);

  if (type === "limit_buy" && target >= currentPrice) {
    throw new BadRequestError(
      `Limit buy price ($${target}) must be below current price ($${currentPrice})`,
    );
  }
  if (type === "limit_sell" && target <= currentPrice) {
    throw new BadRequestError(
      `Limit sell price ($${target}) must be above current price ($${currentPrice})`,
    );
  }
  if (type === "stop_loss" && target >= currentPrice) {
    throw new BadRequestError(
      `Stop-loss price ($${target}) must be below current price ($${currentPrice})`,
    );
  }
  if (type === "take_profit" && target <= currentPrice) {
    throw new BadRequestError(
      `Take-profit price ($${target}) must be above current price ($${currentPrice})`,
    );
  }

  const pendingCount = await Q.crypto.order.count({
    playerMinecraftUuid: playerUuid,
    status: "pending",
  });

  const maxPending = cryptoSetting("MAX_PENDING_ORDERS");
  if (pendingCount >= maxPending) {
    throw new ConflictError(`Maximum ${maxPending} pending orders allowed`);
  }

  const effectiveExpiry = Math.min(
    expiryHours ?? cryptoSetting("ORDER_DEFAULT_EXPIRY_HOURS"),
    cryptoSetting("ORDER_MAX_EXPIRY_HOURS"),
  );
  const expiresAt = new Date(Date.now() + effectiveExpiry * 60 * 60 * 1000);

  let reservedBalance = "0";
  let reservedTokens = 0n;
  let totalReserve = 0;

  if (type === "limit_buy") {
    if (amount > token.availableSupply) {
      throw new ConflictError(
        `Insufficient supply: only ${token.availableSupply} ${token.symbol} available`,
      );
    }

    // Reserve balance: amount × targetPrice + estimated fee
    const lifetimeCount = await getLifetimeTradeCount(playerUuid);
    const rawCost = Number(amount) * Number(targetPrice);
    const fee = calculateFee(rawCost, token.category, lifetimeCount);
    totalReserve = rawCost + fee;
    reservedBalance = totalReserve.toFixed(8);
  } else {
    // limit_sell, stop_loss, take_profit: reserve tokens
    reservedTokens = amount;

    const holding = await Q.crypto.holding
      .where({
        playerMinecraftUuid: playerUuid,
        tokenId: token.id,
      })
      .first();

    if (!holding || holding.amount < amount) {
      throw new ConflictError(
        `Insufficient holdings: you have ${holding?.amount ?? 0n} ${token.symbol}`,
      );
    }

    // Check that unreserved holdings are sufficient
    const existingReserved = await getReservedTokens(playerUuid, token.id);
    const availableToReserve = holding.amount - existingReserved;

    if (amount > availableToReserve) {
      throw new ConflictError(
        `Insufficient unreserved holdings: ${availableToReserve} ${token.symbol} available (${existingReserved} reserved in other orders)`,
      );
    }
  }

  const order = await db.inTransaction(async (tx) => {
    if (type === "limit_buy") {
      await R.balanceRepo.deduct(
        { minecraftUuid: playerUuid },
        totalReserve,
        `Crypto order: reserve for limit buy ${Number(amount)} ${token.symbol} @ $${targetPrice}`,
        BalanceTransactionType.CRYPTO_BUY,
        {
          tokenId: token.id,
          tokenSymbol: token.symbol,
          orderType: type,
          reserved: true,
        },
        tx,
      );
    }

    return tx.crypto.order.createAndReturn({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
      type,
      amount,
      targetPrice,
      reservedBalance,
      reservedTokens,
      expiresAt,
    });
  });

  return {
    orderId: order.id,
    tokenId: token.id,
    symbol: token.symbol,
    type,
    amount: String(amount),
    targetPrice,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Cancels a pending order and releases reserved balance/tokens.
 */
export async function cancelOrder(
  playerUuid: string,
  orderId: number,
): Promise<void> {
  await db.inTransaction(async (tx) => {
    const order = await tx.crypto.order.lockForUpdate(orderId);

    if (!order || order.playerMinecraftUuid !== playerUuid) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (order.status !== "pending") {
      throw new ConflictError(
        `Cannot cancel order with status: ${order.status}`,
      );
    }

    const token = await tx.crypto.token.get({ id: order.tokenId });

    await tx.crypto.order.update(
      { id: orderId },
      { status: "cancelled", cancelledAt: new Date() },
    );

    if (order.type === "limit_buy" && Number(order.reservedBalance) > 0) {
      await R.balanceRepo.add(
        { minecraftUuid: playerUuid },
        Number(order.reservedBalance),
        `Crypto order cancelled: refund for ${token.symbol} limit buy`,
        BalanceTransactionType.CRYPTO_BUY,
        { orderId, refund: true },
        tx,
      );
    }
  });
}

/**
 * Checks all pending orders against current token prices and fills those
 * whose conditions are met. Called on every price tick.
 *
 * @returns Array of filled order results (for socket notifications)
 */
export async function checkAndFillOrders(
  tokens: CryptoToken[],
): Promise<OrderFillResult[]> {
  const results: OrderFillResult[] = [];

  for (const token of tokens) {
    const pendingOrders = await Q.crypto.order
      .where({
        tokenId: token.id,
        status: "pending",
      })
      .all();

    if (pendingOrders.length === 0) continue;

    const currentPrice = Number(token.price);

    for (const order of pendingOrders) {
      const targetPrice = Number(order.targetPrice);
      let shouldFill = false;

      switch (order.type) {
        case "limit_buy":
          shouldFill = currentPrice <= targetPrice;
          break;
        case "limit_sell":
          shouldFill = currentPrice >= targetPrice;
          break;
        case "stop_loss":
          shouldFill = currentPrice <= targetPrice;
          break;
        case "take_profit":
          shouldFill = currentPrice >= targetPrice;
          break;
      }

      if (shouldFill) {
        try {
          const result = await fillOrder(order, token);
          if (result) results.push(result);
        } catch (error) {
          logger.error(
            `Failed to fill order ${order.id} for ${token.symbol}:`,
            error,
          );
          // Cancel the order if it can't be filled (e.g., insufficient supply).
          // A concurrent cancel/expiry may already have closed it, so a failure
          // here must not abort the remaining fills.
          await cancelOrder(order.playerMinecraftUuid, order.id).catch(
            (cancelError) =>
              logger.error(
                `Failed to cancel unfillable order ${order.id}:`,
                cancelError,
              ),
          );
        }
      }
    }
  }

  return results;
}

/**
 * Expires all orders past their expiry time. Releases reserved balance/tokens.
 *
 * @returns Number of orders that were expired
 */
export async function expireOrders(): Promise<number> {
  const pendingOrders = await Q.crypto.order.where({ status: "pending" }).all();

  const now = new Date();
  let expiredCount = 0;

  for (const candidate of pendingOrders) {
    if (candidate.expiresAt > now) continue;

    const expired = await db.inTransaction(async (tx) => {
      const order = await tx.crypto.order.lockForUpdate(candidate.id);
      if (!order || order.status !== "pending" || order.expiresAt > now) {
        return false;
      }

      await tx.crypto.order.update(
        { id: order.id },
        { status: "expired", cancelledAt: now },
      );

      if (order.type === "limit_buy" && Number(order.reservedBalance) > 0) {
        const token = await tx.crypto.token.get({ id: order.tokenId });
        await R.balanceRepo.add(
          { minecraftUuid: order.playerMinecraftUuid },
          Number(order.reservedBalance),
          `Crypto order expired: refund for ${token.symbol} limit buy`,
          BalanceTransactionType.CRYPTO_BUY,
          { orderId: order.id, expired: true },
          tx,
        );
      }

      return true;
    });

    if (expired) expiredCount++;
  }

  return expiredCount;
}

/**
 * Gets a player's pending orders.
 */
export async function getPlayerOrders(
  playerUuid: string,
): Promise<CryptoOrder[]> {
  return Q.crypto.order
    .where({
      playerMinecraftUuid: playerUuid,
      status: "pending",
    })
    .orderBy("createdAt", "desc")
    .all();
}

/**
 * @private Executes a triggered order at the current market price.
 *
 * The entire operation is wrapped in a database transaction that locks the
 * order row (to serialize against cancel/expire) and the token row (to prevent
 * concurrent supply races). The order is re-read under its lock and the fill is
 * abandoned if it is no longer pending, so a concurrent cancel or expiry can
 * never coexist with a fill.
 *
 * For limit buys: deducts from reserved balance, upserts holding, records cost basis,
 * refunds any excess reservation. For sell-type orders: credits balance, consumes
 * cost basis FIFO, calculates realized P&L, updates holding.
 *
 * @param order - The pending order to fill
 * @param token - Current token state (price used for execution)
 * @returns Fill result with execution details, or null if the order was no longer pending
 */
async function fillOrder(
  order: CryptoOrder,
  token: CryptoToken,
): Promise<OrderFillResult | null> {
  const amount = order.amount;
  const amountNum = Number(amount);
  const lifetimeCount = await getLifetimeTradeCount(order.playerMinecraftUuid);
  const triggerType =
    order.type === "limit_buy" || order.type === "limit_sell"
      ? "limit"
      : order.type;

  return await db.inTransaction(async (tx) => {
    const lockedOrder = await tx.crypto.order.lockForUpdate(order.id);
    if (!lockedOrder || lockedOrder.status !== "pending") {
      return null;
    }

    const client = tx.getDb();
    await client.query("SELECT 1 FROM crypto_token WHERE id = $1 FOR UPDATE", [
      token.id,
    ]);
    const freshToken = await tx.crypto.token.get({ id: token.id });
    const price = Number(freshToken.price);

    let feeAmount: number;
    let totalCost: number;
    let realizedPnl: number | null = null;

    if (order.type === "limit_buy") {
      // Buy execution: use actual current price (may be better than target)
      const rawCost = price * amountNum;
      feeAmount = calculateFee(rawCost, freshToken.category, lifetimeCount);
      totalCost = rawCost + feeAmount;

      // Calculate difference from reserved balance
      const reserved = Number(order.reservedBalance);
      const refundAmount = reserved - totalCost;

      // Check supply within lock
      if (amount > freshToken.availableSupply) {
        throw new ConflictError(
          `Insufficient supply: only ${freshToken.availableSupply} ${freshToken.symbol} available`,
        );
      }

      await tx.crypto.token.update(
        { id: freshToken.id },
        { availableSupply: freshToken.availableSupply - amount },
      );

      const existingHolding = await tx.crypto.holding
        .where({
          playerMinecraftUuid: order.playerMinecraftUuid,
          tokenId: freshToken.id,
        })
        .first();

      if (existingHolding) {
        await tx.crypto.holding.update(
          { id: existingHolding.id },
          {
            amount: existingHolding.amount + amount,
            totalCostBasis: (
              Number(existingHolding.totalCostBasis) + rawCost
            ).toFixed(8),
            updatedAt: new Date(),
          },
        );
      } else {
        await tx.crypto.holding.create({
          playerMinecraftUuid: order.playerMinecraftUuid,
          tokenId: freshToken.id,
          amount,
          totalCostBasis: rawCost.toFixed(8),
        });
      }

      await recordCostBasisLot(
        order.playerMinecraftUuid,
        freshToken.id,
        amount,
        freshToken.price,
        tx.crypto,
      );

      // Refund unused reserved balance (price may have dropped since order was placed)
      if (refundAmount > 0.00000001) {
        await R.balanceRepo.add(
          { minecraftUuid: order.playerMinecraftUuid },
          refundAmount,
          `Crypto order filled: refund excess from ${freshToken.symbol} limit buy`,
          BalanceTransactionType.CRYPTO_BUY,
          { orderId: order.id, refund: true },
          tx,
        );
      }
    } else {
      // Sell execution (limit_sell, stop_loss, take_profit)
      const holding = await tx.crypto.holding
        .where({
          playerMinecraftUuid: order.playerMinecraftUuid,
          tokenId: freshToken.id,
        })
        .first();

      if (!holding || holding.amount < amount) {
        throw new ConflictError(
          `Insufficient holdings to fill ${triggerType} sell: have ${holding?.amount ?? 0n} ${freshToken.symbol}, need ${amount}`,
        );
      }

      const rawRevenue = price * amountNum;
      feeAmount = calculateFee(rawRevenue, freshToken.category, lifetimeCount);
      const netRevenue = rawRevenue - feeAmount;
      totalCost = netRevenue;

      await R.balanceRepo.add(
        { minecraftUuid: order.playerMinecraftUuid },
        netRevenue,
        `Crypto order filled: ${triggerType} sell ${amountNum} ${freshToken.symbol} @ $${price}`,
        BalanceTransactionType.CRYPTO_SELL,
        {
          tokenId: freshToken.id,
          tokenSymbol: freshToken.symbol,
          orderId: order.id,
          amount: amountNum,
          price,
          fee: feeAmount,
        },
        tx,
      );

      await tx.crypto.token.update(
        { id: freshToken.id },
        { availableSupply: freshToken.availableSupply + amount },
      );

      const costBasisConsumed = await consumeCostBasis(
        order.playerMinecraftUuid,
        freshToken.id,
        amount,
        tx.crypto,
      );
      realizedPnl = rawRevenue - costBasisConsumed;

      const newAmount = holding.amount - amount;
      if (newAmount <= 0n) {
        await tx.crypto.holding.delete({ id: holding.id });
      } else {
        await tx.crypto.holding.update(
          { id: holding.id },
          {
            amount: newAmount,
            totalCostBasis: (
              Number(holding.totalCostBasis) - costBasisConsumed
            ).toFixed(8),
            updatedAt: new Date(),
          },
        );
      }
    }

    await tx.crypto.transaction.createAndReturn({
      playerMinecraftUuid: order.playerMinecraftUuid,
      tokenId: freshToken.id,
      type: order.type === "limit_buy" ? "buy" : "sell",
      trigger: triggerType,
      amount,
      priceAtExecution: freshToken.price,
      feeAmount: feeAmount.toFixed(8),
      totalCost: totalCost.toFixed(8),
      realizedPnl: realizedPnl?.toFixed(8) ?? null,
      orderId: order.id,
    });

    await tx.crypto.order.update(
      { id: order.id },
      { status: "filled", filledAt: new Date() },
    );

    if (feeAmount > 0) {
      await updateTreasury(feeAmount, freshToken.category, tx.crypto);
    }

    return {
      orderId: order.id,
      playerUuid: order.playerMinecraftUuid,
      tokenId: freshToken.id,
      symbol: freshToken.symbol,
      type: order.type,
      amount,
      filledPrice: freshToken.price,
      feeAmount,
      totalCost,
      realizedPnl,
    };
  });
}
