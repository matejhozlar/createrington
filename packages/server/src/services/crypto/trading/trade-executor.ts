import { Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { calculateFee } from "./fee-calculator";
import { recordCostBasisLot, consumeCostBasis } from "./cost-basis-tracker";
import { recordTradeVolume } from "../engine/price-engine";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import { CRYPTO_CONFIG } from "../crypto.config";
import { recordWhaleEvent } from "../events/news-feed";
import { sendWhaleAlertNotification } from "../notifications";
import { triggerTradeAchievements } from "./achievement-triggers";
import { getService, Services } from "@/services";

// ==========================================================================
// TYPES
// ==========================================================================

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

// ==========================================================================
// HELPERS
// ==========================================================================

/**
 * Enforces per-player trade rate limiting using an in-memory sliding window.
 *
 * @private
 * @param playerUuid - Minecraft UUID of the player to check
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

/**
 * Checks if a trade qualifies as a whale trade and fires news and notification events if so.
 *
 * A trade is considered a whale trade when its amount exceeds WHALE_TRADE_THRESHOLD
 * as a fraction of the token's total supply. Both the news feed and Discord
 * notifications are dispatched fire-and-forget — failures are only logged.
 *
 * @private
 * @param playerUuid - Minecraft UUID of the trading player
 * @param token - Token being traded
 * @param amount - Number of tokens in the trade
 * @param totalCost - Total cost or revenue in in-game currency
 * @param tradeType - Direction of the trade
 */
async function checkWhaleAlert(
  playerUuid: string,
  token: CryptoToken,
  amount: bigint,
  totalCost: number,
  tradeType: "buy" | "sell",
): Promise<void> {
  const supplyRatio = Number(amount) / Number(token.totalSupply);
  if (supplyRatio >= CRYPTO_CONFIG.WHALE_TRADE_THRESHOLD) {
    const player = await Q.player.find({ minecraftUuid: playerUuid });
    const playerName = player?.minecraftUsername ?? "Unknown";
    recordWhaleEvent(
      playerName,
      token.symbol,
      token.id,
      tradeType,
      String(amount),
      totalCost.toFixed(2),
    ).catch((err) => logger.error("Failed to record whale event:", err));
    sendWhaleAlertNotification(
      playerName,
      token.symbol,
      tradeType,
      String(amount),
      totalCost.toFixed(2),
    ).catch((err) => logger.error("Failed to send whale alert notification:", err));
  }
}

/**
 * Returns the total number of trades a player has ever executed.
 *
 * Used by the fee calculator to apply volume-based discounts.
 *
 * @private
 * @param playerUuid - Minecraft UUID of the player
 * @returns Total lifetime trade count
 */
async function getLifetimeTradeCount(playerUuid: string): Promise<number> {
  const result = await Q.crypto.transaction
    .where({ playerMinecraftUuid: playerUuid })
    .count();
  return result;
}

/**
 * Checks if a player holds the Market Veteran achievement, which grants a fee discount.
 *
 * Swallows all errors so that achievement service unavailability never blocks a trade.
 *
 * @private
 * @param playerUuid - Minecraft UUID of the player
 * @returns `true` if the achievement is held, `false` on missing achievement or any error
 */
async function hasMarketVeteranAchievement(playerUuid: string): Promise<boolean> {
  try {
    const svc = await getService(Services.ACHIEVEMENT_SERVICE);
    return await svc.hasAchievement(playerUuid, "crypto_market_veteran");
  } catch {
    return false;
  }
}

// ==========================================================================
// BUY
// ==========================================================================

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
  const [lifetimeCount, hasVeteran] = await Promise.all([
    getLifetimeTradeCount(playerUuid),
    hasMarketVeteranAchievement(playerUuid),
  ]);
  const feeAmount = calculateFee(rawCost, token.category, lifetimeCount, hasVeteran);
  const totalCost = rawCost + feeAmount;

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

  await Q.crypto.token.update(
    { id: token.id },
    { availableSupply: token.availableSupply - amount },
  );

  // Upsert holding — accumulate amount and cost basis if one already exists
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

  // Record cost basis lot for FIFO P&L tracking on future sells
  await recordCostBasisLot(playerUuid, token.id, amount, token.price);

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

  if (feeAmount > 0) {
    await updateTreasury(feeAmount, token.category);
  }

  recordTradeVolume(token.id, amountNum, true);

  checkWhaleAlert(playerUuid, token, amount, totalCost, "buy").catch(() => {});

  const tradeResult: TradeResult = {
    transactionId: txResult.id,
    tokenId: token.id,
    symbol: token.symbol,
    type: "buy",
    amount,
    priceAtExecution: token.price,
    feeAmount,
    totalCost,
  };

  triggerTradeAchievements(playerUuid, token, tradeResult);

  return tradeResult;
}

// ==========================================================================
// SELL
// ==========================================================================

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
  const [lifetimeCount, hasVeteran] = await Promise.all([
    getLifetimeTradeCount(playerUuid),
    hasMarketVeteranAchievement(playerUuid),
  ]);
  const feeAmount = calculateFee(rawRevenue, token.category, lifetimeCount, hasVeteran);
  const netRevenue = rawRevenue - feeAmount;

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

  await Q.crypto.token.update(
    { id: token.id },
    { availableSupply: token.availableSupply + amount },
  );

  // Consume cost basis lots FIFO and calculate realized P&L
  const costBasisConsumed = await consumeCostBasis(playerUuid, token.id, amount);
  const realizedPnl = rawRevenue - costBasisConsumed;

  const newAmount = holding.amount - amount;
  if (newAmount === 0n) {
    // Holding fully liquidated — delete the row rather than leaving a zero-amount record
    await Q.crypto.holding.delete({ id: holding.id });
  } else {
    // Reduce cost basis by the FIFO-consumed amount
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

  if (feeAmount > 0) {
    await updateTreasury(feeAmount, token.category);
  }

  recordTradeVolume(token.id, amountNum, false);

  checkWhaleAlert(playerUuid, token, amount, rawRevenue, "sell").catch(() => {});

  const tradeResult: TradeResult = {
    transactionId: txResult.id,
    tokenId: token.id,
    symbol: token.symbol,
    type: "sell",
    amount,
    priceAtExecution: token.price,
    feeAmount,
    totalCost: netRevenue,
  };

  triggerTradeAchievements(playerUuid, token, tradeResult);

  return tradeResult;
}

// ==========================================================================
// TREASURY
// ==========================================================================

/**
 * Updates the fee treasury with the fee collected from a trade.
 * For memecoins, a portion of the fee is burned (removed from circulation)
 * based on FEES.BURN_RATIO; the remainder is credited as collected.
 *
 * @private
 * @param feeAmount - Total fee amount in in-game currency
 * @param category - Token category ("memecoin", "stable", "blue_chip") used to determine burn ratio
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

  // Treasury is a singleton row — create it on first fee collection if absent
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
