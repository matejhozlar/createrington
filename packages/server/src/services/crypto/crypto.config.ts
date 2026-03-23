/**
 * Central configuration for the in-game crypto market system.
 *
 * All tunable constants live here, grouped by concern:
 * - Tick intervals per token category (memecoin, stablecoin, blue-chip)
 * - Memecoin price dynamics (volatility tiers, momentum, demand pressure, mean reversion)
 * - Stablecoin and blue-chip pricing parameters
 * - Trading limits, fees, and volume discounts
 * - Social features (watchlist, alerts, whale threshold)
 * - Market events and snapshot retention windows
 * - Blue-chip metric mappings (Minecraft stat categories per symbol)
 */
export const CRYPTO_CONFIG = {
  // Price Engine
  MEMECOIN_TICK_INTERVAL_MS: 30_000, // 30 seconds
  STABLECOIN_TICK_INTERVAL_MS: 600_000, // 10 minutes
  BLUECHIP_TICK_INTERVAL_MS: 3_600_000, // 1 hour

  // Memecoin Pricing (upward bias is now per-tier in VOLATILITY, not global)
  MEMECOIN_CRASH_THRESHOLD: 0.002, // auto-crash below $0.002 (matches old system)
  MEMECOIN_CRASH_CLEANUP_HOURS: 24, // delete crashed tokens after 24h (matches old system)

  // Momentum (consecutive direction streaks bias continued movement)
  MEMECOIN_MOMENTUM_STREAK_THRESHOLD: 5, // streaks of 5+ trigger momentum (harder to activate)
  MEMECOIN_MOMENTUM_MAX_STREAK: 5, // cap momentum effect (lower ceiling)
  MEMECOIN_MOMENTUM_STRENGTH: 0.0005, // bias per streak unit (much weaker)

  // Demand Pressure (net buy/sell volume within a tick window shifts price)
  MEMECOIN_DEMAND_SENSITIVITY: 0.01, // multiplier: (netVolume / supply) * this (5x weaker)
  MEMECOIN_MAX_DEMAND_PRESSURE: 0.03, // cap demand pressure at ±3% per tick to prevent low-supply manipulation

  // Mean Reversion (pull price toward 24h average when far off)
  MEMECOIN_MEAN_REVERSION_HIGH_THRESHOLD: 1.5, // trigger when price > 1.5x avg (tighter)
  MEMECOIN_MEAN_REVERSION_LOW_THRESHOLD: 0.7, // trigger when price < 0.7x avg (tighter)
  MEMECOIN_MEAN_REVERSION_STRENGTH: 0.005, // pull strength per tick (stronger correction)

  // Memecoin Generation
  MEMECOIN_MAX_ACTIVE: 5, // max active (non-crashed, non-delisted) memecoins at a time
  MEMECOIN_INITIAL_PRICE_MIN: 0.001,
  MEMECOIN_INITIAL_PRICE_MAX: 100,
  MEMECOIN_TOTAL_SUPPLY_MIN: 500,
  MEMECOIN_TOTAL_SUPPLY_MAX: 50_000,

  // Stablecoin Pricing (flat amounts, not percentages)
  STABLECOIN_FLOOR_PRICE: 1.0,
  STABLECOIN_INFLATION_PER_PLAYER: 0.00035, // flat $ per player per tick
  STABLECOIN_DECAY_RATE: 0.00025, // flat $ decay when no players online

  // Blue-Chip Pricing
  BLUECHIP_SENSITIVITY: 0.01, // metric delta multiplier
  BLUECHIP_NOISE_RANGE: 0.01, // random noise ±1%
  BLUECHIP_MIN_DAILY_BASELINE: 100, // minimum baseline to avoid division by tiny numbers

  // Volatility Tiers (memecoin)
  // Tiers are matched by current price (≤ maxPrice); minChange/maxChange are fractional multipliers on the current price per tick
  // upwardBias: probability of going up (0.5 = neutral, >0.5 = upward drift, <0.5 = downward drift)
  // Higher-priced tokens have progressively lower upward bias — natural price ceiling
  VOLATILITY: {
    PENNY: {
      maxPrice: 0.1,
      minChange: 0.01,
      maxChange: 0.03,
      upwardBias: 0.505,
    },
    LOW: { maxPrice: 5, minChange: 0.005, maxChange: 0.015, upwardBias: 0.502 },
    MID: { maxPrice: 500, minChange: 0.003, maxChange: 0.008, upwardBias: 0.5 },
    HIGH: {
      maxPrice: 10_000,
      minChange: 0.001,
      maxChange: 0.004,
      upwardBias: 0.495,
    },
    MEGA: {
      maxPrice: Infinity,
      minChange: 0.0005,
      maxChange: 0.002,
      upwardBias: 0.49,
    },
  },

  // Fees (old system: 5% buy + 5% sell for memecoins)
  FEES: {
    STABLE: 0,
    BLUE_CHIP: 0.005, // 0.5%
    MEMECOIN: 0.05, // 5% (doubled — matches old system)
    SEASONAL: 0.01, // 1%
    BURN_RATIO: 0.5, // 50% of memecoin fees burned
  },

  // Volume Discounts (none — matches old system)
  VOLUME_DISCOUNTS: [] as { minTrades: number; discount: number }[],

  // Trading Limits
  TRADE_COOLDOWN_PER_TOKEN_MS: 180_000, // 3-minute cooldown per token per player (matches old system)
  MAX_PENDING_ORDERS: 5,
  ORDER_DEFAULT_EXPIRY_HOURS: 24,
  ORDER_MAX_EXPIRY_HOURS: 168, // 7 days

  // Social & Engagement Limits
  MAX_WATCHLIST_SIZE: 20,
  MAX_ACTIVE_ALERTS: 20,
  WHALE_TRADE_THRESHOLD: 0.05, // 5% of token supply
  PORTFOLIO_SNAPSHOT_HOUR: 4, // 04:00 daily

  // Market Events
  EVENT_ROLL_INTERVAL_MS: 3 * 3_600_000, // check every 3 hours (was 1 hour — much less frequent)
  MAX_CONCURRENT_EVENTS: 1, // max 1 simultaneous active event (was 2)

  // IPO (Initial Public Offering)
  IPO_DURATION_MS: 3_600_000, // 1 hour
  IPO_MAX_ALLOCATION_PERCENT: 0.1, // max 10% of supply per player
  IPO_CHECK_INTERVAL_MS: 30_000, // check for ended IPOs every 30s
  IPO_SPAWN_INTERVAL_MS: 24 * 3_600_000, // auto-spawn a new IPO memecoin every 24 hours

  // Snapshot Retention (seconds)
  RETENTION: {
    TICK: 2 * 60 * 60, // 2 hours
    MINUTE: 24 * 60 * 60, // 24 hours
    HOURLY: 30 * 24 * 60 * 60, // 30 days
    DAILY: 365 * 24 * 60 * 60, // 1 year
  },

  // Blue-Chip Metric Mapping (symbol → how to extract the metric)
  // statCategory follows Minecraft's namespaced stat key (e.g. "minecraft:mined")
  BLUECHIP_METRICS: {
    BLK: { type: "minecraft_stat", statCategory: "minecraft:mined" },
    MOB: { type: "minecraft_stat", statCategory: "minecraft:killed" },
    QST: { type: "achievement_count" },
  } as Record<string, BluechipMetricConfig>,
} as const;

export type VolatilityTier = keyof typeof CRYPTO_CONFIG.VOLATILITY;

export type BluechipMetricConfig =
  | { type: "minecraft_stat"; statCategory: string }
  | { type: "achievement_count" };
