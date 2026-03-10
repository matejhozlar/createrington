/**
 * Price engine for the crypto market.
 *
 * Multi-factor model for memecoins:
 *   1. Random walk (volatility-tier-based)
 *   2. Momentum (consecutive direction streaks)
 *   3. Demand pressure (net buy/sell volume within tick window)
 *   4. Mean reversion (pull toward 24h average)
 *
 * Stablecoin model:
 *   Activity-based inflation/decay with a floor price.
 */

import { Q } from "@/db";
import { CRYPTO_CONFIG, type VolatilityTier } from "../crypto.config";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";

/** Result of a single price tick, consumed by persistence and broadcast layers */
export interface PriceUpdate {
  tokenId: number;
  symbol: string;
  oldPrice: string;
  newPrice: string;
  isCrashed: boolean;
}

// ---------------------------------------------------------------------------
// IN-MEMORY STATE (per token, reset on server restart)
// ---------------------------------------------------------------------------

/** Tracks the last N price movement directions for momentum calculation */
interface MomentumState {
  /** Number of consecutive same-direction ticks (positive = up streak, negative = down streak) */
  streak: number;
}

const momentumMap = new Map<number, MomentumState>();

/** Tracks net trade volume (buy - sell) within the current 30s tick window */
const tickVolumeMap = new Map<number, { netVolume: number }>();

/** Stores 24h average price per token for mean reversion */
const avgPrice24hMap = new Map<number, number>();

// ---------------------------------------------------------------------------
// PUBLIC API: volume tracking (called from trade executor)
// ---------------------------------------------------------------------------

/**
 * Records a trade's volume contribution for demand pressure calculation.
 * Call this from the trade executor on every buy/sell.
 *
 * @param tokenId - Token that was traded
 * @param amount - Number of tokens traded
 * @param isBuy - true for buys, false for sells
 */
export function recordTradeVolume(
  tokenId: number,
  amount: number,
  isBuy: boolean,
): void {
  const existing = tickVolumeMap.get(tokenId) ?? { netVolume: 0 };
  existing.netVolume += isBuy ? amount : -amount;
  tickVolumeMap.set(tokenId, existing);
}

/**
 * Gets and resets the accumulated net volume for a token.
 * Called once per tick when computing demand pressure.
 */
function consumeNetVolume(tokenId: number): number {
  const entry = tickVolumeMap.get(tokenId);
  if (!entry) return 0;
  const vol = entry.netVolume;
  entry.netVolume = 0;
  return vol;
}

// ---------------------------------------------------------------------------
// PUBLIC API: 24h average price cache
// ---------------------------------------------------------------------------

/**
 * Refreshes the 24h average price cache for all active tokens.
 * Call this periodically (e.g. every 5 minutes alongside minute aggregation).
 */
export async function refresh24hAverages(): Promise<void> {
  const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const token of tokens) {
    const snapshots = await Q.crypto.price.snapshot
      .where({ tokenId: token.id, interval: "minute" })
      .all();

    const recent = snapshots.filter((s) => s.recordedAt >= cutoff);

    if (recent.length === 0) {
      // Fall back to current price if no history
      avgPrice24hMap.set(token.id, Number(token.price));
      continue;
    }

    const sum = recent.reduce((acc, s) => acc + Number(s.closePrice), 0);
    avgPrice24hMap.set(token.id, sum / recent.length);
  }
}

// ---------------------------------------------------------------------------
// PURE HELPERS
// ---------------------------------------------------------------------------

/** Determines which volatility tier a price falls into */
function getVolatilityTier(price: number): VolatilityTier {
  const tiers = CRYPTO_CONFIG.VOLATILITY;
  if (price < tiers.PENNY.maxPrice) return "PENNY";
  if (price < tiers.LOW.maxPrice) return "LOW";
  if (price < tiers.MID.maxPrice) return "MID";
  if (price < tiers.HIGH.maxPrice) return "HIGH";
  return "MEGA";
}

/** Returns a random float in the range [min, max) */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// MEMECOIN PRICE TICK
// ---------------------------------------------------------------------------

/**
 * Computes the next price for a memecoin token using the multi-factor model:
 *
 *   1. BASE_CHANGE    = random(-volatility, +volatility)
 *   2. MOMENTUM       = streak_direction × strength × min(streak, cap)
 *   3. DEMAND_PRESSURE = (netVolume / availableSupply) × sensitivity
 *   4. MEAN_REVERSION = ±strength when price is far from 24h average
 *   5. FINAL          = (BASE + MOMENTUM + DEMAND + REVERSION) applied to price
 */
export function tickMemecoinPrice(token: CryptoToken): PriceUpdate {
  const currentPrice = Number(token.price);

  // --- 1. Random walk component ---
  const tier = getVolatilityTier(currentPrice);
  const { minChange, maxChange } = CRYPTO_CONFIG.VOLATILITY[tier];
  const volatility = randomBetween(minChange, maxChange);
  const direction =
    Math.random() < CRYPTO_CONFIG.MEMECOIN_UPWARD_BIAS ? 1 : -1;
  const baseChange = direction * volatility;

  // --- 2. Momentum component ---
  const state = momentumMap.get(token.id) ?? { streak: 0 };
  let momentumBias = 0;

  const streakThreshold = CRYPTO_CONFIG.MEMECOIN_MOMENTUM_STREAK_THRESHOLD;
  const maxStreak = CRYPTO_CONFIG.MEMECOIN_MOMENTUM_MAX_STREAK;
  const absStreak = Math.abs(state.streak);

  if (absStreak >= streakThreshold) {
    const cappedStreak = Math.min(absStreak, maxStreak);
    const streakDir = state.streak > 0 ? 1 : -1;
    momentumBias =
      streakDir * CRYPTO_CONFIG.MEMECOIN_MOMENTUM_STRENGTH * cappedStreak;
  }

  // Update streak: extend if same direction, reset if reversed
  if (direction === 1) {
    state.streak = state.streak > 0 ? state.streak + 1 : 1;
  } else {
    state.streak = state.streak < 0 ? state.streak - 1 : -1;
  }
  momentumMap.set(token.id, state);

  // --- 3. Demand pressure component ---
  const netVolume = consumeNetVolume(token.id);
  const availableSupply = Number(token.availableSupply);
  let demandPressure = 0;
  if (availableSupply > 0 && netVolume !== 0) {
    demandPressure =
      (netVolume / availableSupply) * CRYPTO_CONFIG.MEMECOIN_DEMAND_SENSITIVITY;
  }

  // --- 4. Mean reversion component ---
  let meanReversion = 0;
  const avg24h = avgPrice24hMap.get(token.id);
  if (avg24h && avg24h > 0) {
    const ratio = currentPrice / avg24h;
    if (ratio > CRYPTO_CONFIG.MEMECOIN_MEAN_REVERSION_HIGH_THRESHOLD) {
      meanReversion = -CRYPTO_CONFIG.MEMECOIN_MEAN_REVERSION_STRENGTH;
    } else if (ratio < CRYPTO_CONFIG.MEMECOIN_MEAN_REVERSION_LOW_THRESHOLD) {
      meanReversion = CRYPTO_CONFIG.MEMECOIN_MEAN_REVERSION_STRENGTH;
    }
  }

  // --- 5. Final price ---
  const totalChange = baseChange + momentumBias + demandPressure + meanReversion;
  let newPrice = currentPrice * (1 + totalChange);

  const isCrashed = newPrice < CRYPTO_CONFIG.MEMECOIN_CRASH_THRESHOLD;
  if (isCrashed) {
    newPrice = 0;
    // Reset momentum on crash
    momentumMap.delete(token.id);
  }

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

// ---------------------------------------------------------------------------
// PERSISTENCE
// ---------------------------------------------------------------------------

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
