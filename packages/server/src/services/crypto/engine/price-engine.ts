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
import {
  CRYPTO_CONFIG,
  type VolatilityTier,
  type BluechipMetricConfig,
} from "../crypto.config";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import { resolveEffects } from "../events/event-engine";

/** Result of a single price tick, consumed by persistence and broadcast layers */
export interface PriceUpdate {
  tokenId: number;
  symbol: string;
  oldPrice: string;
  newPrice: string;
  isCrashed: boolean;
}

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

/** Stores previous metric values for blue-chip delta calculation (symbol → value) */
const bluechipPreviousMetrics = new Map<string, number>();

/** Stores the baseline daily average metric for normalization (symbol → avg) */
const bluechipBaselineMetrics = new Map<string, number>();

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
 *
 * @private
 * @param tokenId - Token whose volume accumulator to drain
 * @returns Net volume since the last tick (positive = net buys, negative = net sells)
 */
function consumeNetVolume(tokenId: number): number {
  const entry = tickVolumeMap.get(tokenId);
  if (!entry) return 0;
  const vol = entry.netVolume;
  entry.netVolume = 0;
  return vol;
}

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

/**
 * Determines which volatility tier a price falls into.
 *
 * Tiers are checked in ascending order: the first threshold that the price
 * falls below determines the tier; prices above all thresholds land in MEGA.
 *
 * @private
 * @param price - Current token price in coin units
 * @returns The matching volatility tier key
 */
function getVolatilityTier(price: number): VolatilityTier {
  const tiers = CRYPTO_CONFIG.VOLATILITY;
  if (price < tiers.PENNY.maxPrice) return "PENNY";
  if (price < tiers.LOW.maxPrice) return "LOW";
  if (price < tiers.MID.maxPrice) return "MID";
  if (price < tiers.HIGH.maxPrice) return "HIGH";
  return "MEGA";
}

/**
 * Returns a random float in [min, max).
 *
 * @private
 * @param min - Lower bound (inclusive)
 * @param max - Upper bound (exclusive)
 * @returns Random float within the given range
 */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Computes the next price for a memecoin token using the multi-factor model:
 *
 *   1. BASE_CHANGE     = random(-volatility, +volatility) × event volatility multiplier
 *   2. MOMENTUM        = streak_direction × strength × min(streak, cap)
 *   3. DEMAND_PRESSURE = (netVolume / availableSupply) × sensitivity
 *   4. MEAN_REVERSION  = ±strength when price is far from 24h average
 *   5. EVENT_BIAS      = additive direction bias from active market events
 *   6. FINAL           = (BASE + MOMENTUM + DEMAND + REVERSION + EVENT_BIAS) applied to price
 *
 * @param token - The memecoin token to price
 * @returns A PriceUpdate describing the old and new price, plus crash flag
 */
export function tickMemecoinPrice(token: CryptoToken): PriceUpdate {
  const currentPrice = Number(token.price);

  // Resolve active event effects for this token
  const eventEffects = resolveEffects(token.id);

  const tier = getVolatilityTier(currentPrice);
  const { minChange, maxChange, upwardBias } = CRYPTO_CONFIG.VOLATILITY[tier];
  const volatility =
    randomBetween(minChange, maxChange) * eventEffects.volatilityMultiplier;
  const direction = Math.random() < upwardBias ? 1 : -1;
  const baseChange = direction * volatility;

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

  const netVolume = consumeNetVolume(token.id);
  const availableSupply = Number(token.availableSupply);
  let demandPressure = 0;
  if (availableSupply > 0 && netVolume !== 0) {
    const rawPressure =
      (netVolume / availableSupply) * CRYPTO_CONFIG.MEMECOIN_DEMAND_SENSITIVITY;
    const cap = CRYPTO_CONFIG.MEMECOIN_MAX_DEMAND_PRESSURE;
    demandPressure = Math.max(-cap, Math.min(cap, rawPressure));
  }

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

  const eventBias = eventEffects.directionBias;

  const totalChange =
    baseChange + momentumBias + demandPressure + meanReversion + eventBias;
  let newPrice = currentPrice * (1 + totalChange);

  const isCrashed = newPrice < CRYPTO_CONFIG.MEMECOIN_CRASH_THRESHOLD;
  if (isCrashed) {
    newPrice = 0;
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
 * Inflation rate is modified by active market events (e.g. Gold Rush).
 * Never drops below the configured floor price.
 *
 * @param token - The stablecoin token to price
 * @param activePlayerCount - Number of players currently online
 * @returns A PriceUpdate describing the old and new price (isCrashed is always false)
 */
export function tickStablecoinPrice(
  token: CryptoToken,
  activePlayerCount: number,
): PriceUpdate {
  const currentPrice = Number(token.price);
  const floorPrice = token.floorPrice
    ? Number(token.floorPrice)
    : CRYPTO_CONFIG.STABLECOIN_FLOOR_PRICE;

  const eventEffects = resolveEffects(token.id);

  // Flat amount model (not percentage-based): linear growth like old system
  let priceChange: number;
  if (activePlayerCount > 0) {
    priceChange =
      CRYPTO_CONFIG.STABLECOIN_INFLATION_PER_PLAYER *
      activePlayerCount *
      eventEffects.stablecoinInflationMultiplier;
  } else {
    priceChange = -CRYPTO_CONFIG.STABLECOIN_DECAY_RATE;
  }

  const newPrice = Math.max(floorPrice, currentPrice + priceChange);

  return {
    tokenId: token.id,
    symbol: token.symbol,
    oldPrice: token.price,
    newPrice: newPrice.toFixed(8),
    isCrashed: false,
  };
}

/**
 * Aggregates a metric from player_minecraft_stats for blue-chip pricing.
 * For "minecraft_stat" type: sums all values under the given stat category
 * across all players and servers.
 * For "achievement_count" type: counts total completed achievements.
 *
 * @param config - Blue-chip metric configuration describing type and stat category
 * @returns The aggregated numeric metric value
 */
export async function aggregateBluechipMetric(
  config: BluechipMetricConfig,
): Promise<number> {
  if (config.type === "achievement_count") {
    return Q.player.achievement.where({}).count();
  }

  // minecraft_stat: sum all values under the stat category across all players
  const allStats = await Q.player.minecraft.stats.where({}).all();
  let total = 0;

  for (const row of allStats) {
    const stats = row.stats as Record<string, Record<string, number>> | null;
    if (!stats) continue;

    const category = stats[config.statCategory];
    if (!category || typeof category !== "object") continue;

    for (const value of Object.values(category)) {
      if (typeof value === "number") {
        total += value;
      }
    }
  }

  return total;
}

/**
 * Computes the next price for a blue-chip token based on server metrics.
 *
 * Formula:
 *   1. metric_delta     = current_metric - previous_metric
 *   2. normalized_delta = metric_delta / baseline_daily_average
 *   3. price_change     = normalized_delta × sensitivity × (1 + random_noise)
 *   4. new_price        = max(floor_price, price × (1 + price_change))
 *
 * On the first tick (no previous metric), only random noise is applied.
 * The baseline daily average is a rolling exponential moving average of deltas.
 *
 * @param token - The blue-chip token to price
 * @param currentMetric - Latest aggregated metric value (e.g. total stat count)
 * @returns A PriceUpdate describing the old and new price (isCrashed is always false)
 */
export function tickBluechipPrice(
  token: CryptoToken,
  currentMetric: number,
): PriceUpdate {
  const currentPrice = Number(token.price);
  const floorPrice = token.floorPrice ? Number(token.floorPrice) : 0.01;
  const symbol = token.symbol;

  const previousMetric = bluechipPreviousMetrics.get(symbol);
  bluechipPreviousMetrics.set(symbol, currentMetric);

  let priceChange: number;

  if (previousMetric === undefined) {
    // First tick: no delta available, apply minimal noise only
    priceChange = randomBetween(
      -CRYPTO_CONFIG.BLUECHIP_NOISE_RANGE,
      CRYPTO_CONFIG.BLUECHIP_NOISE_RANGE,
    );
  } else {
    const metricDelta = currentMetric - previousMetric;

    // Update baseline (exponential moving average of absolute deltas)
    const prevBaseline =
      bluechipBaselineMetrics.get(symbol) ??
      Math.max(
        Math.abs(metricDelta),
        CRYPTO_CONFIG.BLUECHIP_MIN_DAILY_BASELINE,
      );
    const newBaseline = prevBaseline * 0.95 + Math.abs(metricDelta) * 0.05;
    bluechipBaselineMetrics.set(
      symbol,
      Math.max(newBaseline, CRYPTO_CONFIG.BLUECHIP_MIN_DAILY_BASELINE),
    );

    const baseline = bluechipBaselineMetrics.get(symbol)!;
    const normalizedDelta = metricDelta / baseline;

    const noise = randomBetween(
      -CRYPTO_CONFIG.BLUECHIP_NOISE_RANGE,
      CRYPTO_CONFIG.BLUECHIP_NOISE_RANGE,
    );
    priceChange =
      normalizedDelta * CRYPTO_CONFIG.BLUECHIP_SENSITIVITY * (1 + noise);
  }

  const newPrice = Math.max(floorPrice, currentPrice * (1 + priceChange));

  return {
    tokenId: token.id,
    symbol: token.symbol,
    oldPrice: token.price,
    newPrice: newPrice.toFixed(8),
    isCrashed: false, // blue-chips never crash
  };
}

/**
 * Seeds the blue-chip metric baseline from the token's metadata.
 * Call this on startup to restore state from the last run.
 *
 * @param symbol - Token symbol used as the in-memory state key
 * @param previousMetric - Last known metric value to seed the delta calculation
 * @param baseline - Last known EMA baseline to seed normalization
 */
export function seedBluechipState(
  symbol: string,
  previousMetric?: number,
  baseline?: number,
): void {
  if (previousMetric !== undefined) {
    bluechipPreviousMetrics.set(symbol, previousMetric);
  }
  if (baseline !== undefined) {
    bluechipBaselineMetrics.set(
      symbol,
      Math.max(baseline, CRYPTO_CONFIG.BLUECHIP_MIN_DAILY_BASELINE),
    );
  }
}

/**
 * Returns the current in-memory state for a blue-chip token's metric tracking.
 * Used to persist state in the token's metadata field for restart resilience.
 *
 * @param symbol - Token symbol used as the in-memory state key
 * @returns Object containing the last recorded metric value and EMA baseline, if seeded
 */
export function getBluechipState(symbol: string): {
  previousMetric?: number;
  baseline?: number;
} {
  return {
    previousMetric: bluechipPreviousMetrics.get(symbol),
    baseline: bluechipBaselineMetrics.get(symbol),
  };
}

/**
 * Persists a price update to the crypto_token table, marking as crashed if applicable.
 *
 * @param update - The computed price update to write to the database
 */
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

/**
 * Records a tick-level OHLCV snapshot, rounded to the nearest 30-second boundary.
 *
 * @param update - The price update to snapshot (old/new price used for open/close/high/low)
 * @param volume - Total trade volume for this tick window (defaults to 0)
 */
export async function recordTickSnapshot(
  update: PriceUpdate,
  volume: bigint = 0n,
): Promise<void> {
  const now = new Date();
  now.setMilliseconds(0);
  now.setSeconds(now.getSeconds() - (now.getSeconds() % 30));

  const high =
    Number(update.newPrice) > Number(update.oldPrice)
      ? update.newPrice
      : update.oldPrice;
  const low =
    Number(update.newPrice) < Number(update.oldPrice)
      ? update.newPrice
      : update.oldPrice;

  await Q.crypto.price.snapshot.upsertOhlcv({
    tokenId: update.tokenId,
    interval: "tick",
    openPrice: update.oldPrice,
    highPrice: high,
    lowPrice: low,
    closePrice: update.newPrice,
    volume,
    recordedAt: now,
  });
}
