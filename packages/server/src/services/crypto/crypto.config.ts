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

  // Memecoin Generation
  MEMECOIN_INITIAL_PRICE_MIN: 0.0001,
  MEMECOIN_INITIAL_PRICE_MAX: 1000,
  MEMECOIN_TOTAL_SUPPLY_MIN: 1_000,
  MEMECOIN_TOTAL_SUPPLY_MAX: 10_000_000,

  // Stablecoin Pricing
  STABLECOIN_FLOOR_PRICE: 1.0,
  STABLECOIN_INFLATION_PER_PLAYER: 0.0003,
  STABLECOIN_DECAY_RATE: 0.00005,

  // Volatility Tiers (memecoin)
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

  // Snapshot Retention (seconds)
  RETENTION: {
    TICK: 2 * 60 * 60, // 2 hours
    MINUTE: 24 * 60 * 60, // 24 hours
    HOURLY: 30 * 24 * 60 * 60, // 30 days
    DAILY: 365 * 24 * 60 * 60, // 1 year
  },
} as const;

export type VolatilityTier = keyof typeof CRYPTO_CONFIG.VOLATILITY;
