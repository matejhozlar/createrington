/**
 * Trade execution engine for the crypto market.
 * Handles buy and sell order processing including balance changes,
 * supply tracking, holding management, fee collection, and treasury updates.
 */

import { Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { calculateFee } from "./fee-calculator";
import { recordCostBasisLot, consumeCostBasis } from "./cost-basis-tracker";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import { CRYPTO_CONFIG } from "../crypto.config";

export interface TradeResult {
  transactionId: number;
  tokenId: number;
  symbol: string;
  type: "buy" | "sell";
  amount: bigint;
  priceAtExecution: string;
  feeAmount: number;
  totalCost: number;
}

interface TradeRateLimiter {
  counts: Map<string, { count: number; resetAt: number }>;
}

const rateLimiter: TradeRateLimiter = { counts: new Map() };

/**
 * Enforces per-player trade rate limiting using an in-memory sliding window.
 * @throws Error if the player exceeds MAX_TRADES_PER_MINUTE
 */
function checkRateLimit(playerUuid: string): void {
  const now = Date.now();
  const entry = rateLimiter.counts.get(playerUuid);

  if (!entry || now > entry.resetAt) {
    rateLimiter.counts.set(playerUuid, {
      count: 1,
      resetAt: now + 60_000,
    });
    return;
  }

  if (entry.count >= CRYPTO_CONFIG.MAX_TRADES_PER_MINUTE) {
    throw new Error(
      `Rate limit exceeded: max ${CRYPTO_CONFIG.MAX_TRADES_PER_MINUTE} trades per minute`,
    );
  }

  entry.count++;
}

/** Queries the total number of trades a player has ever executed (for volume discounts) */
async function getLifetimeTradeCount(playerUuid: string): Promise<number> {
  const result = await Q.crypto.transaction
    .where({ playerMinecraftUuid: playerUuid })
    .count();
  return result;
}

/**
 * Executes a buy order: deducts player balance, updates token supply,
 * upserts the player's holding with cost basis tracking, records the
 * transaction, and collects fees into the treasury.
 *
 * @param playerUuid - Minecraft UUID of the buyer
 * @param token - Token being purchased (must not be crashed or delisted)
 * @param amount - Number of tokens to buy
 * @returns Trade result with transaction details
 * @throws Error on crashed/delisted tokens, insufficient supply, or rate limit
 */
export async function executeBuy(
  playerUuid: string,
  token: CryptoToken,
  amount: bigint,
): Promise<TradeResult> {
  if (token.isCrashed) {
    throw new Error(`Token ${token.symbol} has crashed and cannot be purchased`);
  }

  if (token.delistedAt) {
    throw new Error(`Token ${token.symbol} has been delisted`);
  }

  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  if (amount > token.availableSupply) {
    throw new Error(
      `Insufficient supply: only ${token.availableSupply} ${token.symbol} available`,
    );
  }

  checkRateLimit(playerUuid);

  const price = Number(token.price);
  const amountNum = Number(amount);
  const rawCost = price * amountNum;
  const lifetimeCount = await getLifetimeTradeCount(playerUuid);
  const feeAmount = calculateFee(rawCost, token.category, lifetimeCount);
  const totalCost = rawCost + feeAmount;

  // Deduct player balance
  await R.balanceRepo.deduct(
    { minecraftUuid: playerUuid },
    totalCost,
    `Crypto buy: ${amountNum} ${token.symbol} @ $${price}`,
    BalanceTransactionType.CRYPTO_BUY,
    {
      tokenId: token.id,
      tokenSymbol: token.symbol,
      amount: amountNum,
      price,
      fee: feeAmount,
    },
  );

  // Update token supply
  await Q.crypto.token.update(
    { id: token.id },
    { availableSupply: token.availableSupply - amount },
  );

  // Upsert holding
  const existingHolding = await Q.crypto.holding
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
    })
    .first();

  if (existingHolding) {
    await Q.crypto.holding.update(
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
    await Q.crypto.holding.create({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
      amount,
      totalCostBasis: rawCost.toFixed(8),
    });
  }

  // Record cost basis lot for FIFO P&L tracking
  await recordCostBasisLot(playerUuid, token.id, amount, token.price);

  // Record transaction
  const txResult = await Q.crypto.transaction.createAndReturn({
    playerMinecraftUuid: playerUuid,
    tokenId: token.id,
    type: "buy",
    trigger: "market",
    amount,
    priceAtExecution: token.price,
    feeAmount: feeAmount.toFixed(8),
    totalCost: totalCost.toFixed(8),
  });

  // Update treasury with collected fee
  if (feeAmount > 0) {
    await updateTreasury(feeAmount, token.category);
  }

  return {
    transactionId: txResult.id,
    tokenId: token.id,
    symbol: token.symbol,
    type: "buy",
    amount,
    priceAtExecution: token.price,
    feeAmount,
    totalCost,
  };
}

/**
 * Executes a sell order: credits player balance (minus fees), returns tokens
 * to available supply, adjusts cost basis proportionally, calculates realized
 * P&L, records the transaction, and collects fees into the treasury.
 *
 * @param playerUuid - Minecraft UUID of the seller
 * @param token - Token being sold
 * @param amount - Number of tokens to sell
 * @returns Trade result with transaction details including realized P&L
 * @throws Error on insufficient holdings or rate limit
 */
export async function executeSell(
  playerUuid: string,
  token: CryptoToken,
  amount: bigint,
): Promise<TradeResult> {
  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  checkRateLimit(playerUuid);

  // Check holdings
  const holding = await Q.crypto.holding
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
    })
    .first();

  if (!holding || holding.amount < amount) {
    throw new Error(
      `Insufficient holdings: you have ${holding?.amount ?? 0n} ${token.symbol}`,
    );
  }

  const price = Number(token.price);
  const amountNum = Number(amount);
  const rawRevenue = price * amountNum;
  const lifetimeCount = await getLifetimeTradeCount(playerUuid);
  const feeAmount = calculateFee(rawRevenue, token.category, lifetimeCount);
  const netRevenue = rawRevenue - feeAmount;

  // Add player balance
  await R.balanceRepo.add(
    { minecraftUuid: playerUuid },
    netRevenue,
    `Crypto sell: ${amountNum} ${token.symbol} @ $${price}`,
    BalanceTransactionType.CRYPTO_SELL,
    {
      tokenId: token.id,
      tokenSymbol: token.symbol,
      amount: amountNum,
      price,
      fee: feeAmount,
    },
  );

  // Update token supply
  await Q.crypto.token.update(
    { id: token.id },
    { availableSupply: token.availableSupply + amount },
  );

  // Consume cost basis lots FIFO and calculate realized P&L
  const costBasisConsumed = await consumeCostBasis(playerUuid, token.id, amount);
  const realizedPnl = rawRevenue - costBasisConsumed;

  // Update holding
  const newAmount = holding.amount - amount;
  if (newAmount === 0n) {
    await Q.crypto.holding.delete({ id: holding.id });
  } else {
    // Reduce cost basis by the consumed amount
    await Q.crypto.holding.update(
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

  // Record transaction
  const txResult = await Q.crypto.transaction.createAndReturn({
    playerMinecraftUuid: playerUuid,
    tokenId: token.id,
    type: "sell",
    trigger: "market",
    amount,
    priceAtExecution: token.price,
    feeAmount: feeAmount.toFixed(8),
    totalCost: netRevenue.toFixed(8),
    realizedPnl: realizedPnl.toFixed(8),
  });

  // Update treasury with collected fee
  if (feeAmount > 0) {
    await updateTreasury(feeAmount, token.category);
  }

  return {
    transactionId: txResult.id,
    tokenId: token.id,
    symbol: token.symbol,
    type: "sell",
    amount,
    priceAtExecution: token.price,
    feeAmount,
    totalCost: netRevenue,
  };
}

/**
 * Updates the fee treasury. For memecoins, a portion of the fee is burned
 * (removed from circulation) based on FEES.BURN_RATIO.
 */
async function updateTreasury(
  feeAmount: number,
  category: string,
): Promise<void> {
  const burnAmount =
    category === "memecoin"
      ? feeAmount * CRYPTO_CONFIG.FEES.BURN_RATIO
      : 0;
  const collectedAmount = feeAmount - burnAmount;

  // Get or create treasury row
  const treasury = await Q.crypto.treasury.where({}).first();
  if (treasury) {
    await Q.crypto.treasury.update(
      { id: treasury.id },
      {
        totalCollected: (
          Number(treasury.totalCollected) + collectedAmount
        ).toFixed(8),
        totalBurned: (
          Number(treasury.totalBurned) + burnAmount
        ).toFixed(8),
        updatedAt: new Date(),
      },
    );
  } else {
    await Q.crypto.treasury.create({
      totalCollected: collectedAmount.toFixed(8),
      totalBurned: burnAmount.toFixed(8),
    });
  }
}
