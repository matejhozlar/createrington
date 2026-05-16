/**
 * Trade Executor
 *
 * Entry point for all player-initiated buy and sell orders in the crypto market:
 * - Validates trade preconditions (token status, supply, rate limits, IPO rules)
 * - Calculates fees using the fee calculator and deducts/credits player balance
 * - Maintains token available supply and per-player holdings with cost basis
 * - Records every trade as a transaction and routes fees to the treasury
 * - Fires whale alerts and triggers achievement evaluation after each trade
 *
 * NOTE: Achievement evaluation is always fire-and-forget from this module.
 * Callers that need newly earned achievement names should call
 * `evaluateTradeAchievements` directly from `achievement-triggers`.
 */

import { db, Q, R } from "@/db";
import type { DatabaseQueries } from "@/generated/db";
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

/** Per-player-per-token cooldown tracker: key is `${playerUuid}:${tokenId}`, value is last trade timestamp */
const cooldownMap = new Map<string, number>();

/**
 * Returns the absolute timestamp (ms) when the cooldown expires for a player+token pair,
 * or null if there is no active cooldown.
 */
export function getCooldownExpiresAt(
  playerUuid: string,
  tokenId: number,
): number | null {
  const key = `${playerUuid}:${tokenId}`;
  const lastTradeTime = cooldownMap.get(key);
  if (!lastTradeTime) return null;

  const expiresAt = lastTradeTime + CRYPTO_CONFIG.TRADE_COOLDOWN_PER_TOKEN_MS;
  return expiresAt > Date.now() ? expiresAt : null;
}

/**
 * Enforces a per-token trade cooldown per player (matches old system's 3-minute per-token cooldown).
 *
 * @private
 * @param playerUuid - Minecraft UUID of the player to check
 * @param tokenId - Token being traded
 * @param tokenSymbol - Token symbol for error messages
 * @throws Error if the player is still on cooldown for this token
 */
function checkRateLimit(
  playerUuid: string,
  tokenId: number,
  tokenSymbol: string,
): void {
  const now = Date.now();
  const key = `${playerUuid}:${tokenId}`;
  const lastTradeTime = cooldownMap.get(key);

  if (
    lastTradeTime &&
    now - lastTradeTime < CRYPTO_CONFIG.TRADE_COOLDOWN_PER_TOKEN_MS
  ) {
    const remainingSeconds = Math.ceil(
      (CRYPTO_CONFIG.TRADE_COOLDOWN_PER_TOKEN_MS - (now - lastTradeTime)) /
        1000,
    );
    throw new Error(
      `Trade cooldown: wait ${remainingSeconds}s before trading ${tokenSymbol} again`,
    );
  }

  cooldownMap.set(key, now);
}

/**
 * Checks if a trade qualifies as a whale trade and fires news and notification events if so.
 *
 * A trade is considered a whale trade when its amount exceeds WHALE_TRADE_THRESHOLD
 * as a fraction of the token's total supply. Both the news feed and Discord
 * notifications are dispatched fire-and-forget: failures are only logged.
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
    const whaleEvent = await recordWhaleEvent(
      playerName,
      token.symbol,
      token.id,
      tradeType,
      String(amount),
      totalCost.toFixed(2),
    ).catch((err) => {
      logger.error("Failed to record whale event:", err);
      return null;
    });
    sendWhaleAlertNotification(
      playerName,
      token.symbol,
      tradeType,
      String(amount),
      totalCost.toFixed(2),
      whaleEvent?.id,
    ).catch((err) =>
      logger.error("Failed to send whale alert notification:", err),
    );
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
async function hasMarketVeteranAchievement(
  playerUuid: string,
): Promise<boolean> {
  try {
    const svc = await getService(Services.ACHIEVEMENT_SERVICE);
    return await svc.hasAchievement(playerUuid, "crypto_market_veteran");
  } catch {
    return false;
  }
}

/**
 * Locks a token row with SELECT FOR UPDATE within a transaction,
 * then re-fetches fresh data. Prevents concurrent trades from
 * reading stale supply/price values.
 *
 * @private
 * @param tx - Transaction-bound DatabaseQueries instance
 * @param tokenId - Token ID to lock
 * @returns Fresh token data with the row locked until commit
 */
async function lockAndFetchToken(
  tx: DatabaseQueries,
  tokenId: number,
): Promise<CryptoToken> {
  const client = tx.getDb();
  await client.query("SELECT 1 FROM crypto_token WHERE id = $1 FOR UPDATE", [
    tokenId,
  ]);
  return tx.crypto.token.get({ id: tokenId });
}

/**
 * Returns true if the token is currently in its IPO window.
 *
 * @param token - Token to check
 * @returns `true` if `ipoEndsAt` is set and has not yet passed
 */
export function isInIpo(token: CryptoToken): boolean {
  return !!token.ipoEndsAt && token.ipoEndsAt > new Date();
}

/**
 * Executes a buy order: deducts player balance, updates token supply,
 * upserts the player's holding with cost basis tracking, records the
 * transaction, and collects fees into the treasury.
 *
 * The entire operation is wrapped in a database transaction with a
 * SELECT FOR UPDATE lock on the token row to prevent race conditions.
 *
 * During an IPO, the buy executes at the fixed IPO price and enforces
 * a per-player allocation limit (IPO_MAX_ALLOCATION_PERCENT of total supply).
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
    throw new Error(
      `Token ${token.symbol} has crashed and cannot be purchased`,
    );
  }

  if (token.delistedAt) {
    throw new Error(`Token ${token.symbol} has been delisted`);
  }

  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  checkRateLimit(playerUuid, token.id, token.symbol);

  // Pre-fetch data that doesn't need to be inside the transaction
  const [lifetimeCount, hasVeteran] = await Promise.all([
    getLifetimeTradeCount(playerUuid),
    hasMarketVeteranAchievement(playerUuid),
  ]);

  const tradeResult = await db.inTransaction(async (tx) => {
    const freshToken = await lockAndFetchToken(tx, token.id);

    if (amount > freshToken.availableSupply) {
      throw new Error(
        `Insufficient supply: only ${freshToken.availableSupply} ${freshToken.symbol} available`,
      );
    }

    // IPO allocation enforcement (within transaction for atomicity)
    if (isInIpo(freshToken)) {
      const maxAllocation = BigInt(
        Math.floor(
          Number(freshToken.totalSupply) *
            CRYPTO_CONFIG.IPO_MAX_ALLOCATION_PERCENT,
        ),
      );

      const existingHolding = await tx.crypto.holding
        .where({ playerMinecraftUuid: playerUuid, tokenId: freshToken.id })
        .first();

      const currentHeld = existingHolding?.amount ?? 0n;
      if (currentHeld + amount > maxAllocation) {
        const remaining = maxAllocation - currentHeld;
        throw new Error(
          `IPO allocation limit: you can buy at most ${remaining} more ${freshToken.symbol} (max ${maxAllocation} per player)`,
        );
      }
    }

    // During IPO, use the fixed IPO price instead of the current market price
    const price = isInIpo(freshToken)
      ? Number(freshToken.ipoPrice)
      : Number(freshToken.price);
    const amountNum = Number(amount);
    const rawCost = price * amountNum;
    const feeAmount = calculateFee(
      rawCost,
      freshToken.category,
      lifetimeCount,
      hasVeteran,
    );
    // Round to 3 decimal places to match the balance system's precision
    const totalCost = Math.round((rawCost + feeAmount) * 1000) / 1000;

    // Deduct balance (joins this transaction via txOverride)
    await R.balanceRepo.deduct(
      { minecraftUuid: playerUuid },
      totalCost,
      `Crypto buy: ${amountNum} ${freshToken.symbol} @ $${price}`,
      BalanceTransactionType.CRYPTO_BUY,
      {
        tokenId: freshToken.id,
        tokenSymbol: freshToken.symbol,
        amount: amountNum,
        price,
        fee: feeAmount,
      },
      tx,
    );

    // Update supply atomically (using fresh data under lock)
    await tx.crypto.token.update(
      { id: freshToken.id },
      { availableSupply: freshToken.availableSupply - amount },
    );

    const priceStr = price.toFixed(8);

    const holding = await tx.crypto.holding
      .where({
        playerMinecraftUuid: playerUuid,
        tokenId: freshToken.id,
      })
      .first();

    if (holding) {
      await tx.crypto.holding.update(
        { id: holding.id },
        {
          amount: holding.amount + amount,
          totalCostBasis: (Number(holding.totalCostBasis) + rawCost).toFixed(8),
          updatedAt: new Date(),
        },
      );
    } else {
      await tx.crypto.holding.create({
        playerMinecraftUuid: playerUuid,
        tokenId: freshToken.id,
        amount,
        totalCostBasis: rawCost.toFixed(8),
      });
    }

    // Record cost basis lot for FIFO P&L tracking on future sells
    await recordCostBasisLot(
      playerUuid,
      freshToken.id,
      amount,
      priceStr,
      tx.crypto,
    );

    const txResult = await tx.crypto.transaction.createAndReturn({
      playerMinecraftUuid: playerUuid,
      tokenId: freshToken.id,
      type: "buy",
      trigger: "market",
      amount,
      priceAtExecution: priceStr,
      feeAmount: feeAmount.toFixed(8),
      totalCost: totalCost.toFixed(8),
    });

    if (feeAmount > 0) {
      await updateTreasury(feeAmount, freshToken.category, tx);
    }

    return {
      transactionId: txResult.id,
      tokenId: freshToken.id,
      symbol: freshToken.symbol,
      type: "buy" as const,
      amount,
      priceAtExecution: priceStr,
      feeAmount,
      totalCost,
    };
  });

  // Fire-and-forget side effects (outside transaction)
  recordTradeVolume(token.id, Number(amount), true);
  checkWhaleAlert(
    playerUuid,
    token,
    amount,
    tradeResult.totalCost,
    "buy",
  ).catch(() => {});
  triggerTradeAchievements(playerUuid, token, tradeResult);

  return tradeResult;
}

/**
 * Executes a sell order: credits player balance (minus fees), returns tokens
 * to available supply, adjusts cost basis proportionally, calculates realized
 * P&L, records the transaction, and collects fees into the treasury.
 *
 * The entire operation is wrapped in a database transaction with a
 * SELECT FOR UPDATE lock on the token row to prevent race conditions.
 *
 * @param playerUuid - Minecraft UUID of the seller
 * @param token - Token being sold
 * @param amount - Number of tokens to sell
 * @returns Trade result with transaction details including realized P&L
 * @throws Error if the token is still in its IPO phase, holdings are insufficient, or rate limit is exceeded
 */
export async function executeSell(
  playerUuid: string,
  token: CryptoToken,
  amount: bigint,
): Promise<TradeResult> {
  if (isInIpo(token)) {
    throw new Error(
      `${token.symbol} is in its IPO phase: selling is not allowed until trading opens`,
    );
  }

  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  checkRateLimit(playerUuid, token.id, token.symbol);

  // Pre-fetch data that doesn't need to be inside the transaction
  const [lifetimeCount, hasVeteran] = await Promise.all([
    getLifetimeTradeCount(playerUuid),
    hasMarketVeteranAchievement(playerUuid),
  ]);

  const tradeResult = await db.inTransaction(async (tx) => {
    const freshToken = await lockAndFetchToken(tx, token.id);

    // Verify holdings within the transaction
    const holding = await tx.crypto.holding
      .where({
        playerMinecraftUuid: playerUuid,
        tokenId: freshToken.id,
      })
      .first();

    if (!holding || holding.amount < amount) {
      throw new Error(
        `Insufficient holdings: you have ${holding?.amount ?? 0n} ${freshToken.symbol}`,
      );
    }

    const price = Number(freshToken.price);
    const amountNum = Number(amount);
    const rawRevenue = price * amountNum;
    const feeAmount = calculateFee(
      rawRevenue,
      freshToken.category,
      lifetimeCount,
      hasVeteran,
    );
    // Round to 3 decimal places to match the balance system's precision
    const netRevenue = Math.round((rawRevenue - feeAmount) * 1000) / 1000;

    // Credit balance (joins this transaction via txOverride)
    await R.balanceRepo.add(
      { minecraftUuid: playerUuid },
      netRevenue,
      `Crypto sell: ${amountNum} ${freshToken.symbol} @ $${price}`,
      BalanceTransactionType.CRYPTO_SELL,
      {
        tokenId: freshToken.id,
        tokenSymbol: freshToken.symbol,
        amount: amountNum,
        price,
        fee: feeAmount,
      },
      tx,
    );

    // Return tokens to supply atomically (using fresh data under lock)
    await tx.crypto.token.update(
      { id: freshToken.id },
      { availableSupply: freshToken.availableSupply + amount },
    );

    // Consume cost basis lots FIFO and calculate realized P&L
    const costBasisConsumed = await consumeCostBasis(
      playerUuid,
      freshToken.id,
      amount,
      tx.crypto,
    );
    const realizedPnl = rawRevenue - costBasisConsumed;

    const newAmount = holding.amount - amount;
    if (newAmount === 0n) {
      // Holding fully liquidated: delete the row
      await tx.crypto.holding.delete({ id: holding.id });
    } else {
      // Reduce cost basis by the FIFO-consumed amount
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

    const txResult = await tx.crypto.transaction.createAndReturn({
      playerMinecraftUuid: playerUuid,
      tokenId: freshToken.id,
      type: "sell",
      trigger: "market",
      amount,
      priceAtExecution: freshToken.price,
      feeAmount: feeAmount.toFixed(8),
      totalCost: netRevenue.toFixed(8),
      realizedPnl: realizedPnl.toFixed(8),
    });

    if (feeAmount > 0) {
      await updateTreasury(feeAmount, freshToken.category, tx);
    }

    return {
      transactionId: txResult.id,
      tokenId: freshToken.id,
      symbol: freshToken.symbol,
      type: "sell" as const,
      amount,
      priceAtExecution: freshToken.price,
      feeAmount,
      totalCost: netRevenue,
    };
  });

  // Fire-and-forget side effects (outside transaction)
  recordTradeVolume(token.id, Number(amount), false);
  checkWhaleAlert(
    playerUuid,
    token,
    amount,
    tradeResult.totalCost,
    "sell",
  ).catch(() => {});
  triggerTradeAchievements(playerUuid, token, tradeResult);

  return tradeResult;
}

/**
 * Updates the fee treasury with the fee collected from a trade.
 * For memecoins, a portion of the fee is burned (removed from circulation)
 * based on FEES.BURN_RATIO; the remainder is credited as collected.
 *
 * @private
 * @param feeAmount - Total fee amount in in-game currency
 * @param category - Token category ("memecoin", "stable", "blue_chip") used to determine burn ratio
 * @param txOverride - Optional transaction-bound DatabaseQueries for atomic operations
 */
async function updateTreasury(
  feeAmount: number,
  category: string,
  txOverride?: DatabaseQueries,
): Promise<void> {
  const burnAmount =
    category === "memecoin" ? feeAmount * CRYPTO_CONFIG.FEES.BURN_RATIO : 0;
  const collectedAmount = feeAmount - burnAmount;

  const crypto = txOverride ? txOverride.crypto : Q.crypto;

  // Treasury is a singleton row: create it on first fee collection if absent
  const treasury = await crypto.treasury.where({}).first();
  if (treasury) {
    await crypto.treasury.update(
      { id: treasury.id },
      {
        totalCollected: (
          Number(treasury.totalCollected) + collectedAmount
        ).toFixed(8),
        totalBurned: (Number(treasury.totalBurned) + burnAmount).toFixed(8),
        updatedAt: new Date(),
      },
    );
  } else {
    await crypto.treasury.create({
      totalCollected: collectedAmount.toFixed(8),
      totalBurned: burnAmount.toFixed(8),
    });
  }
}
