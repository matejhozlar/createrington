/**
 * Central configuration for the in-game crypto market system.
 * All tunable constants (tick rates, fees, volatility, retention) live here.
 */
export const CRYPTO_CONFIG = {
  // Price Engine
  MEMECOIN_TICK_INTERVAL_MS: 30_000, // 30 seconds
  STABLECOIN_TICK_INTERVAL_MS: 600_000, // 10 minutes
  BLUECHIP_TICK_INTERVAL_MS: 3_600_000, // 1 hour

  // Memecoin Pricing
  MEMECOIN_UPWARD_BIAS: 0.505, // 50.5% chance of going up
  MEMECOIN_CRASH_THRESHOLD: 0.001, // auto-crash below $0.001
  MEMECOIN_CRASH_CLEANUP_HOURS: 48, // delete crashed tokens after 48h

  // Momentum (consecutive direction streaks bias continued movement)
  MEMECOIN_MOMENTUM_STREAK_THRESHOLD: 3, // streaks of 3+ trigger momentum
  MEMECOIN_MOMENTUM_MAX_STREAK: 8, // cap momentum effect
  MEMECOIN_MOMENTUM_STRENGTH: 0.002, // bias per streak unit

  // Demand Pressure (net buy/sell volume within a tick window shifts price)
  MEMECOIN_DEMAND_SENSITIVITY: 0.05, // multiplier: (netVolume / supply) * this

  // Mean Reversion (pull price toward 24h average when far off)
  MEMECOIN_MEAN_REVERSION_HIGH_THRESHOLD: 2.0, // trigger when price > 2x avg
  MEMECOIN_MEAN_REVERSION_LOW_THRESHOLD: 0.5, // trigger when price < 0.5x avg
  MEMECOIN_MEAN_REVERSION_STRENGTH: 0.003, // pull strength per tick

  // Memecoin Generation
  MEMECOIN_INITIAL_PRICE_MIN: 0.0001,
  MEMECOIN_INITIAL_PRICE_MAX: 1000,
  MEMECOIN_TOTAL_SUPPLY_MIN: 1_000,
  MEMECOIN_TOTAL_SUPPLY_MAX: 10_000_000,

  // Stablecoin Pricing
  STABLECOIN_FLOOR_PRICE: 1.0,
  STABLECOIN_INFLATION_PER_PLAYER: 0.0003,
  STABLECOIN_DECAY_RATE: 0.00005,

  // Blue-Chip Pricing
  BLUECHIP_SENSITIVITY: 0.01, // metric delta multiplier
  BLUECHIP_NOISE_RANGE: 0.01, // random noise ±1%
  BLUECHIP_MIN_DAILY_BASELINE: 100, // minimum baseline to avoid division by tiny numbers

  // Volatility Tiers (memecoin)
  // Tiers are matched by current price (≤ maxPrice); minChange/maxChange are fractional multipliers on the current price per tick
  VOLATILITY: {
    PENNY: { maxPrice: 0.1, minChange: 0.05, maxChange: 0.15 },
    LOW: { maxPrice: 5, minChange: 0.02, maxChange: 0.05 },
    MID: { maxPrice: 500, minChange: 0.01, maxChange: 0.03 },
    HIGH: { maxPrice: 10_000, minChange: 0.005, maxChange: 0.015 },
    MEGA: { maxPrice: Infinity, minChange: 0.002, maxChange: 0.008 },
  },

  // Fees
  FEES: {
    STABLE: 0,
    BLUE_CHIP: 0.005, // 0.5%
    MEMECOIN: 0.025, // 2.5%
    SEASONAL: 0.01, // 1%
    BURN_RATIO: 0.5, // 50% of memecoin fees burned
  },

  // Volume Discounts
  VOLUME_DISCOUNTS: [
    { minTrades: 100, discount: 0.1 }, // 10% off fees
    { minTrades: 500, discount: 0.2 }, // 20% off fees
    { minTrades: 1000, discount: 0.3 }, // 30% off fees
  ],

  // Trading Limits
  MAX_TRADES_PER_MINUTE: 10,
  MAX_PENDING_ORDERS: 10,
  ORDER_DEFAULT_EXPIRY_HOURS: 24,
  ORDER_MAX_EXPIRY_HOURS: 168, // 7 days

  // Social & Engagement Limits
  MAX_WATCHLIST_SIZE: 20,
  MAX_ACTIVE_ALERTS: 20,
  WHALE_TRADE_THRESHOLD: 0.05, // 5% of token supply
  PORTFOLIO_SNAPSHOT_HOUR: 4, // 04:00 daily

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
