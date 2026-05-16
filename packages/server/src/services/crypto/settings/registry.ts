import { z } from "zod";
import { CRYPTO_CONFIG } from "../crypto.config";

export type SettingGroup =
  | "master"
  | "generation"
  | "tick"
  | "trading"
  | "fees"
  | "events"
  | "social"
  | "ipo";

export type IntervalRestartTarget =
  | "memecoinTicker"
  | "stablecoinTicker"
  | "bluechipTicker"
  | "eventRoller"
  | "ipoSpawn";

export interface SettingDefinition<T> {
  key: string;
  group: SettingGroup;
  label: string;
  description?: string;
  defaultValue: T;
  validator: z.ZodType<T>;
  restartsInterval?: IntervalRestartTarget;
}

const positiveNumber = z.number().positive();
const positiveInt = z.number().int().positive();
const ratio = z.number().min(0).max(1);
const positiveMs = z.number().int().min(1000, "Must be at least 1000ms");

function def<T>(d: SettingDefinition<T>): SettingDefinition<T> {
  return d;
}

export const SETTINGS_REGISTRY = {
  cryptoEnabled: def<boolean>({
    key: "cryptoEnabled",
    group: "master",
    label: "Crypto market enabled",
    description:
      "Master switch. When off, all tickers pause, generation/IPO/events are skipped, and trade mutations are blocked. Read-only views still render frozen state.",
    defaultValue: true,
    validator: z.boolean(),
  }),

  MEMECOIN_MAX_ACTIVE: def<number>({
    key: "MEMECOIN_MAX_ACTIVE",
    group: "generation",
    label: "Max active memecoins",
    description:
      "Generation is skipped when the count of non-crashed, non-delisted memecoins meets this cap.",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_MAX_ACTIVE,
    validator: positiveInt.max(100),
  }),
  IPO_SPAWN_INTERVAL_MS: def<number>({
    key: "IPO_SPAWN_INTERVAL_MS",
    group: "generation",
    label: "IPO spawn interval (ms)",
    description: "How often the auto-spawner attempts a new IPO memecoin.",
    defaultValue: CRYPTO_CONFIG.IPO_SPAWN_INTERVAL_MS,
    validator: positiveMs,
    restartsInterval: "ipoSpawn",
  }),
  MEMECOIN_INITIAL_PRICE_MIN: def<number>({
    key: "MEMECOIN_INITIAL_PRICE_MIN",
    group: "generation",
    label: "Memecoin initial price min",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_INITIAL_PRICE_MIN,
    validator: positiveNumber,
  }),
  MEMECOIN_INITIAL_PRICE_MAX: def<number>({
    key: "MEMECOIN_INITIAL_PRICE_MAX",
    group: "generation",
    label: "Memecoin initial price max",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_INITIAL_PRICE_MAX,
    validator: positiveNumber,
  }),
  MEMECOIN_TOTAL_SUPPLY_MIN: def<number>({
    key: "MEMECOIN_TOTAL_SUPPLY_MIN",
    group: "generation",
    label: "Memecoin total supply min",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_TOTAL_SUPPLY_MIN,
    validator: positiveInt,
  }),
  MEMECOIN_TOTAL_SUPPLY_MAX: def<number>({
    key: "MEMECOIN_TOTAL_SUPPLY_MAX",
    group: "generation",
    label: "Memecoin total supply max",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_TOTAL_SUPPLY_MAX,
    validator: positiveInt,
  }),
  MEMECOIN_CRASH_CLEANUP_HOURS: def<number>({
    key: "MEMECOIN_CRASH_CLEANUP_HOURS",
    group: "generation",
    label: "Crash cleanup delay (hours)",
    description:
      "How long a crashed token (and its holdings/snapshots) is kept before being deleted.",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_CRASH_CLEANUP_HOURS,
    validator: positiveNumber,
  }),

  MEMECOIN_TICK_INTERVAL_MS: def<number>({
    key: "MEMECOIN_TICK_INTERVAL_MS",
    group: "tick",
    label: "Memecoin tick interval (ms)",
    defaultValue: CRYPTO_CONFIG.MEMECOIN_TICK_INTERVAL_MS,
    validator: positiveMs,
    restartsInterval: "memecoinTicker",
  }),
  STABLECOIN_TICK_INTERVAL_MS: def<number>({
    key: "STABLECOIN_TICK_INTERVAL_MS",
    group: "tick",
    label: "Stablecoin tick interval (ms)",
    defaultValue: CRYPTO_CONFIG.STABLECOIN_TICK_INTERVAL_MS,
    validator: positiveMs,
    restartsInterval: "stablecoinTicker",
  }),
  BLUECHIP_TICK_INTERVAL_MS: def<number>({
    key: "BLUECHIP_TICK_INTERVAL_MS",
    group: "tick",
    label: "Blue-chip tick interval (ms)",
    defaultValue: CRYPTO_CONFIG.BLUECHIP_TICK_INTERVAL_MS,
    validator: positiveMs,
    restartsInterval: "bluechipTicker",
  }),

  TRADE_COOLDOWN_PER_TOKEN_MS: def<number>({
    key: "TRADE_COOLDOWN_PER_TOKEN_MS",
    group: "trading",
    label: "Per-token trade cooldown (ms)",
    defaultValue: CRYPTO_CONFIG.TRADE_COOLDOWN_PER_TOKEN_MS,
    validator: z.number().int().nonnegative(),
  }),
  MAX_PENDING_ORDERS: def<number>({
    key: "MAX_PENDING_ORDERS",
    group: "trading",
    label: "Max pending orders per player",
    defaultValue: CRYPTO_CONFIG.MAX_PENDING_ORDERS,
    validator: positiveInt.max(1000),
  }),
  ORDER_DEFAULT_EXPIRY_HOURS: def<number>({
    key: "ORDER_DEFAULT_EXPIRY_HOURS",
    group: "trading",
    label: "Order default expiry (hours)",
    defaultValue: CRYPTO_CONFIG.ORDER_DEFAULT_EXPIRY_HOURS,
    validator: positiveNumber,
  }),
  ORDER_MAX_EXPIRY_HOURS: def<number>({
    key: "ORDER_MAX_EXPIRY_HOURS",
    group: "trading",
    label: "Order max expiry (hours)",
    defaultValue: CRYPTO_CONFIG.ORDER_MAX_EXPIRY_HOURS,
    validator: positiveNumber,
  }),

  "FEES.MEMECOIN": def<number>({
    key: "FEES.MEMECOIN",
    group: "fees",
    label: "Memecoin fee",
    description: "Fractional fee on memecoin trades (0.05 = 5%).",
    defaultValue: CRYPTO_CONFIG.FEES.MEMECOIN,
    validator: ratio,
  }),
  "FEES.BLUE_CHIP": def<number>({
    key: "FEES.BLUE_CHIP",
    group: "fees",
    label: "Blue-chip fee",
    defaultValue: CRYPTO_CONFIG.FEES.BLUE_CHIP,
    validator: ratio,
  }),
  "FEES.STABLE": def<number>({
    key: "FEES.STABLE",
    group: "fees",
    label: "Stablecoin fee",
    defaultValue: CRYPTO_CONFIG.FEES.STABLE,
    validator: ratio,
  }),
  "FEES.SEASONAL": def<number>({
    key: "FEES.SEASONAL",
    group: "fees",
    label: "Seasonal fee",
    defaultValue: CRYPTO_CONFIG.FEES.SEASONAL,
    validator: ratio,
  }),
  "FEES.BURN_RATIO": def<number>({
    key: "FEES.BURN_RATIO",
    group: "fees",
    label: "Fee burn ratio",
    description:
      "Fraction of memecoin fees burned rather than sent to treasury.",
    defaultValue: CRYPTO_CONFIG.FEES.BURN_RATIO,
    validator: ratio,
  }),

  EVENT_ROLL_INTERVAL_MS: def<number>({
    key: "EVENT_ROLL_INTERVAL_MS",
    group: "events",
    label: "Event roll interval (ms)",
    defaultValue: CRYPTO_CONFIG.EVENT_ROLL_INTERVAL_MS,
    validator: positiveMs,
    restartsInterval: "eventRoller",
  }),
  MAX_CONCURRENT_EVENTS: def<number>({
    key: "MAX_CONCURRENT_EVENTS",
    group: "events",
    label: "Max concurrent events",
    defaultValue: CRYPTO_CONFIG.MAX_CONCURRENT_EVENTS,
    validator: positiveInt.max(20),
  }),

  MAX_WATCHLIST_SIZE: def<number>({
    key: "MAX_WATCHLIST_SIZE",
    group: "social",
    label: "Max watchlist size",
    defaultValue: CRYPTO_CONFIG.MAX_WATCHLIST_SIZE,
    validator: positiveInt.max(1000),
  }),
  MAX_ACTIVE_ALERTS: def<number>({
    key: "MAX_ACTIVE_ALERTS",
    group: "social",
    label: "Max active alerts",
    defaultValue: CRYPTO_CONFIG.MAX_ACTIVE_ALERTS,
    validator: positiveInt.max(1000),
  }),
  WHALE_TRADE_THRESHOLD: def<number>({
    key: "WHALE_TRADE_THRESHOLD",
    group: "social",
    label: "Whale trade threshold",
    description:
      "Fraction of token supply at which a trade is flagged as a whale move.",
    defaultValue: CRYPTO_CONFIG.WHALE_TRADE_THRESHOLD,
    validator: ratio,
  }),

  IPO_DURATION_MS: def<number>({
    key: "IPO_DURATION_MS",
    group: "ipo",
    label: "IPO duration (ms)",
    defaultValue: CRYPTO_CONFIG.IPO_DURATION_MS,
    validator: positiveMs,
  }),
  IPO_MAX_ALLOCATION_PERCENT: def<number>({
    key: "IPO_MAX_ALLOCATION_PERCENT",
    group: "ipo",
    label: "IPO max allocation per player",
    description: "Fraction of supply any single player can buy during an IPO.",
    defaultValue: CRYPTO_CONFIG.IPO_MAX_ALLOCATION_PERCENT,
    validator: ratio,
  }),
} satisfies Record<string, SettingDefinition<unknown>>;

export type SettingKey = keyof typeof SETTINGS_REGISTRY;

export type SettingValueOf<K extends SettingKey> =
  (typeof SETTINGS_REGISTRY)[K] extends SettingDefinition<infer V> ? V : never;

export const ALL_SETTING_KEYS = Object.keys(SETTINGS_REGISTRY) as SettingKey[];

export function getSettingDef<K extends SettingKey>(
  key: K,
): (typeof SETTINGS_REGISTRY)[K] {
  return SETTINGS_REGISTRY[key];
}
