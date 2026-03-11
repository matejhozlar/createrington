/**
 * Market event type definitions and their effects on the price engine.
 *
 * Each event definition describes:
 * - What conditions it can produce (volatility, bias, fee changes)
 * - Duration range and probability per hourly roll
 * - Whether it targets a specific token or is market-wide
 */

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface EventEffect {
  /** Multiplier on memecoin volatility (e.g. 1.5 = 50% more volatile) */
  volatilityMultiplier?: number;
  /** Additive bias on price direction (-1 to 1, e.g. 0.05 = 5% upward bias boost) */
  directionBias?: number;
  /** Multiplier on all trading fees (e.g. 2.0 = double fees, 0 = no fees) */
  feeMultiplier?: number;
  /** Multiplier on stablecoin inflation rate */
  stablecoinInflationMultiplier?: number;
  /** Instant price change applied once when the event starts (fractional, e.g. -0.3 = -30%) */
  instantPriceChange?: number;
  /** Instant supply change applied once (fractional, e.g. -0.3 = burn 30% of available supply) */
  instantSupplyChange?: number;
}

export interface EventDefinition {
  /** Unique event type key */
  type: MarketEventType;
  /** Human-readable name */
  name: string;
  /** Template description (may contain {token} placeholder) */
  description: string;
  /** Whether the event targets a specific token or is market-wide */
  scope: "market" | "token";
  /** If token-scoped, which categories can be targeted */
  targetCategories?: ("memecoin" | "stable" | "blue_chip" | "seasonal")[];
  /** Probability per hourly roll (0 to 1) */
  probability: number;
  /** Duration range in milliseconds [min, max] — null for instant events */
  durationMs: [number, number] | null;
  /** Effects applied to the price engine during the event */
  effects: EventEffect;
  /** News feed severity */
  severity: "info" | "warning" | "critical";
}

export type MarketEventType =
  | "bull_run"
  | "bear_market"
  | "flash_crash"
  | "pump_and_dump"
  | "liquidity_drought"
  | "gold_rush"
  | "supply_shock"
  | "tax_holiday"
  | "whale_dump"
  | "new_listing_frenzy";

// ---------------------------------------------------------------------------
// EVENT CATALOG
// ---------------------------------------------------------------------------

/** Full catalog of all market events, keyed by event type */
export const EVENT_DEFINITIONS: Record<MarketEventType, EventDefinition> = {
  bull_run: {
    type: "bull_run",
    name: "Bull Run",
    description:
      "Market sentiment is overwhelmingly positive! Memecoin volatility increased with upward bias.",
    scope: "market",
    probability: 0.03,
    durationMs: [1 * 60 * 60 * 1000, 4 * 60 * 60 * 1000], // 1-4 hours
    effects: {
      volatilityMultiplier: 1.5,
      directionBias: 0.05,
    },
    severity: "info",
  },

  bear_market: {
    type: "bear_market",
    name: "Bear Market",
    description:
      "Fear is spreading across the market. Memecoin volatility increased with downward pressure.",
    scope: "market",
    probability: 0.03,
    durationMs: [1 * 60 * 60 * 1000, 4 * 60 * 60 * 1000], // 1-4 hours
    effects: {
      volatilityMultiplier: 1.5,
      directionBias: -0.05,
    },
    severity: "warning",
  },

  flash_crash: {
    type: "flash_crash",
    name: "Flash Crash",
    description:
      "{token} just flash-crashed, losing 20-50% of its value instantly!",
    scope: "token",
    targetCategories: ["memecoin"],
    probability: 0.01,
    durationMs: null, // instant
    effects: {
      instantPriceChange: -0.35, // avg -35%, randomized between -20% and -50% at runtime
    },
    severity: "critical",
  },

  pump_and_dump: {
    type: "pump_and_dump",
    name: "Pump & Dump",
    description:
      "{token} is experiencing suspicious price action! A massive spike followed by a gradual decline.",
    scope: "token",
    targetCategories: ["memecoin"],
    probability: 0.02,
    durationMs: [2 * 60 * 60 * 1000, 2 * 60 * 60 * 1000], // exactly 2 hours
    effects: {
      // Phase 1 (first half): strong upward bias
      // Phase 2 (second half): strong downward bias
      // Handled specially in the event engine
      volatilityMultiplier: 1.3,
      directionBias: 0.08, // starts positive, flips halfway
    },
    severity: "warning",
  },

  liquidity_drought: {
    type: "liquidity_drought",
    name: "Liquidity Drought",
    description: "Trading fees doubled due to low market liquidity!",
    scope: "market",
    probability: 0.02,
    durationMs: [30 * 60 * 1000, 2 * 60 * 60 * 1000], // 30min - 2 hours
    effects: {
      feeMultiplier: 2.0,
    },
    severity: "warning",
  },

  gold_rush: {
    type: "gold_rush",
    name: "Gold Rush",
    description:
      "Server activity is booming! Stablecoin inflation rate tripled.",
    scope: "market",
    probability: 0.02,
    durationMs: [1 * 60 * 60 * 1000, 3 * 60 * 60 * 1000], // 1-3 hours
    effects: {
      stablecoinInflationMultiplier: 3.0,
    },
    severity: "info",
  },

  supply_shock: {
    type: "supply_shock",
    name: "Supply Shock",
    description:
      "{token} just lost 20-40% of its available supply! Remaining tokens are now scarcer.",
    scope: "token",
    targetCategories: ["memecoin"],
    probability: 0.01,
    durationMs: null, // instant
    effects: {
      instantSupplyChange: -0.3, // avg -30%, randomized at runtime
    },
    severity: "warning",
  },

  tax_holiday: {
    type: "tax_holiday",
    name: "Tax Holiday",
    description: "All trading fees reduced to 0% for a limited time!",
    scope: "market",
    probability: 0.01,
    durationMs: [1 * 60 * 60 * 1000, 2 * 60 * 60 * 1000], // 1-2 hours
    effects: {
      feeMultiplier: 0,
    },
    severity: "info",
  },

  whale_dump: {
    type: "whale_dump",
    name: "Whale Dump",
    description:
      "A massive sell-off hit {token}! The price has been pushed down significantly.",
    scope: "token",
    targetCategories: ["memecoin"],
    probability: 0.02,
    durationMs: null, // instant
    effects: {
      instantPriceChange: -0.15, // -15% instant drop
    },
    severity: "warning",
  },

  new_listing_frenzy: {
    type: "new_listing_frenzy",
    name: "New Listing Frenzy",
    description:
      "A new token just listed! All memecoin volatility boosted by 20% for 1 hour.",
    scope: "market",
    probability: 0, // triggered manually on IPO, not rolled randomly
    durationMs: [1 * 60 * 60 * 1000, 1 * 60 * 60 * 1000], // exactly 1 hour
    effects: {
      volatilityMultiplier: 1.2,
    },
    severity: "info",
  },
};
