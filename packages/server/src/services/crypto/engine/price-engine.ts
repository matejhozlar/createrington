/**
 * Price engine for the crypto market.
 * Pure functions for computing price ticks and helpers
 * for persisting updates and snapshots.
 */

import { Q } from "@/db";
import { CRYPTO_CONFIG, type VolatilityTier } from "../crypto.config";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";

export interface PriceUpdate {
  tokenId: number;
  symbol: string;
  oldPrice: string;
  newPrice: string;
  isCrashed: boolean;
}

/** Determines which volatility tier a price falls into */
function getVolatilityTier(price: number): VolatilityTier {
  const tiers = CRYPTO_CONFIG.VOLATILITY;
  if (price < tiers.PENNY.maxPrice) return "PENNY";
  if (price < tiers.LOW.maxPrice) return "LOW";
  if (price < tiers.MID.maxPrice) return "MID";
  if (price < tiers.HIGH.maxPrice) return "HIGH";
  return "MEGA";
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Calculates a random percentage price change scaled to the token's volatility tier */
function calculateMemecoinPriceChange(currentPrice: number): number {
  const tier = getVolatilityTier(currentPrice);
  const { minChange, maxChange } = CRYPTO_CONFIG.VOLATILITY[tier];

  const volatility = randomBetween(minChange, maxChange);
  const direction =
    Math.random() < CRYPTO_CONFIG.MEMECOIN_UPWARD_BIAS ? 1 : -1;

  return direction * volatility;
}

/**
 * Computes the next price for a memecoin token.
 * Applies volatility-based random walk with slight upward bias.
 * Marks token as crashed if price drops below the crash threshold.
 */
export function tickMemecoinPrice(token: CryptoToken): PriceUpdate {
  const currentPrice = Number(token.price);
  const change = calculateMemecoinPriceChange(currentPrice);
  let newPrice = currentPrice * (1 + change);

  const isCrashed = newPrice < CRYPTO_CONFIG.MEMECOIN_CRASH_THRESHOLD;
  if (isCrashed) {
    newPrice = 0;
  }

  // Ensure price doesn't go negative
  newPrice = Math.max(0, newPrice);

  return {
    tokenId: token.id,
    symbol: token.symbol,
    oldPrice: token.price,
    newPrice: newPrice.toFixed(8),
    isCrashed,
  };
}

/**
 * Computes the next price for a stablecoin token.
 * Price inflates proportionally to active player count and decays when no players are online.
 * Never drops below the configured floor price.
 */
export function tickStablecoinPrice(
  token: CryptoToken,
  activePlayerCount: number,
): PriceUpdate {
  const currentPrice = Number(token.price);
  const floorPrice = token.floorPrice
    ? Number(token.floorPrice)
    : CRYPTO_CONFIG.STABLECOIN_FLOOR_PRICE;

  let priceChange: number;
  if (activePlayerCount > 0) {
    priceChange =
      CRYPTO_CONFIG.STABLECOIN_INFLATION_PER_PLAYER * activePlayerCount;
  } else {
    priceChange = -CRYPTO_CONFIG.STABLECOIN_DECAY_RATE;
  }

  const newPrice = Math.max(floorPrice, currentPrice * (1 + priceChange));

  return {
    tokenId: token.id,
    symbol: token.symbol,
    oldPrice: token.price,
    newPrice: newPrice.toFixed(8),
    isCrashed: false,
  };
}

/** Persists a price update to the crypto_token table, marking as crashed if applicable */
export async function applyPriceUpdate(update: PriceUpdate): Promise<void> {
  if (update.isCrashed) {
    await Q.crypto.token.update(
      { id: update.tokenId },
      {
        price: update.newPrice,
        isCrashed: true,
        crashedAt: new Date(),
      },
    );
  } else {
    await Q.crypto.token.update(
      { id: update.tokenId },
      { price: update.newPrice },
    );
  }
}

/** Records a tick-level OHLCV snapshot, rounded to the nearest 30-second boundary */
export async function recordTickSnapshot(
  update: PriceUpdate,
  volume: bigint = 0n,
): Promise<void> {
  const price = update.newPrice;
  const now = new Date();
  // Round to nearest 30s boundary
  now.setMilliseconds(0);
  now.setSeconds(now.getSeconds() - (now.getSeconds() % 30));

  await Q.crypto.price.snapshot.create({
    tokenId: update.tokenId,
    interval: "tick",
    openPrice: update.oldPrice,
    highPrice:
      Number(update.newPrice) > Number(update.oldPrice)
        ? update.newPrice
        : update.oldPrice,
    lowPrice:
      Number(update.newPrice) < Number(update.oldPrice)
        ? update.newPrice
        : update.oldPrice,
    closePrice: price,
    volume,
    recordedAt: now,
  });
}
