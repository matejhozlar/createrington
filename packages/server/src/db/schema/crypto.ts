import {
  pgTable,
  serial,
  integer,
  bigint,
  text,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  check,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { player } from "./player";
import {
  cryptoTokenCategoryEnum,
  cryptoTradeTypeEnum,
  cryptoTradeTriggerEnum,
  cryptoOrderTypeEnum,
  cryptoOrderStatusEnum,
  cryptoPriceIntervalEnum,
  cryptoAlertDirectionEnum,
  cryptoEventSeverityEnum,
} from "./enums";

// ============================================================================
// Crypto Market Tables
// ============================================================================

// --- crypto_token ---
// Master record for each tradable token: symbol, supply, current price, and crash/delist state.

export const cryptoToken = pgTable("crypto_token", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull().unique(),
  description: text("description"),
  category: cryptoTokenCategoryEnum("category").notNull(),
  totalSupply: bigint("total_supply", { mode: "bigint" }).notNull(),
  availableSupply: bigint("available_supply", { mode: "bigint" }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  floorPrice: numeric("floor_price", { precision: 20, scale: 8 }),
  isCrashed: boolean("is_crashed").notNull().default(false),
  crashedAt: timestamp("crashed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  delistedAt: timestamp("delisted_at", { withTimezone: true }),
  ipoEndsAt: timestamp("ipo_ends_at", { withTimezone: true }), // null after IPO closes; orders and limit trades are blocked while this is in the future
  ipoPrice: numeric("ipo_price", { precision: 20, scale: 8 }), // fixed price at which the token is sold during its IPO window
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

// --- crypto_holding ---
// Current token balance and aggregate cost basis per player, updated on every buy/sell.

export const cryptoHolding = pgTable(
  "crypto_holding",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    totalCostBasis: numeric("total_cost_basis", { precision: 20, scale: 8 })
      .notNull()
      .default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_crypto_holding_player_token").on(
      table.playerMinecraftUuid,
      table.tokenId,
    ),
    index("idx_crypto_holding_player").on(table.playerMinecraftUuid),
    index("idx_crypto_holding_token").on(table.tokenId),
    check("chk_crypto_holding_amount", sql`${table.amount} >= 0`),
  ],
);

// --- crypto_transaction ---
// Immutable record of every executed trade, including fees, execution price, and realized P&L.

export const cryptoTransaction = pgTable(
  "crypto_transaction",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    type: cryptoTradeTypeEnum("type").notNull(),
    trigger: cryptoTradeTriggerEnum("trigger").notNull().default("market"),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    priceAtExecution: numeric("price_at_execution", {
      precision: 20,
      scale: 8,
    }).notNull(),
    feeAmount: numeric("fee_amount", { precision: 20, scale: 8 })
      .notNull()
      .default(sql`0`),
    totalCost: numeric("total_cost", { precision: 20, scale: 8 }).notNull(),
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }),
    orderId: integer("order_id").references(() => cryptoOrder.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_crypto_transaction_player").on(table.playerMinecraftUuid),
    index("idx_crypto_transaction_token_time").on(
      table.tokenId,
      table.createdAt.desc(),
    ),
  ],
);

// --- crypto_price_snapshot ---
// OHLCV candlestick data at multiple intervals; interval column acts as the discriminator.

export const cryptoPriceSnapshot = pgTable(
  "crypto_price_snapshot",
  {
    id: serial("id").primaryKey(),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    interval: cryptoPriceIntervalEnum("interval").notNull(),
    openPrice: numeric("open_price", { precision: 20, scale: 8 }).notNull(),
    highPrice: numeric("high_price", { precision: 20, scale: 8 }).notNull(),
    lowPrice: numeric("low_price", { precision: 20, scale: 8 }).notNull(),
    closePrice: numeric("close_price", { precision: 20, scale: 8 }).notNull(),
    volume: bigint("volume", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_crypto_price_snapshot_unique").on(
      table.tokenId,
      table.interval,
      table.recordedAt,
    ),
    index("idx_crypto_price_snapshot_lookup").on(
      table.tokenId,
      table.interval,
      table.recordedAt.desc(),
    ),
  ],
);

// --- crypto_order ---
// Pending limit, stop-loss, and take-profit orders; executed by the price engine when the target is hit.

export const cryptoOrder = pgTable(
  "crypto_order",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    type: cryptoOrderTypeEnum("type").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
    reservedBalance: numeric("reserved_balance", { precision: 20, scale: 8 })
      .notNull()
      .default(sql`0`),
    reservedTokens: bigint("reserved_tokens", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    status: cryptoOrderStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    filledAt: timestamp("filled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_crypto_order_player_status").on(
      table.playerMinecraftUuid,
      table.status,
    ),
    index("idx_crypto_order_token_pending")
      .on(table.tokenId, table.status)
      .where(sql`${table.status} = 'pending'`),
  ],
);

// --- crypto_cost_basis ---
// Individual buy lots consumed in FIFO order when calculating realized P&L on sells.

export const cryptoCostBasis = pgTable(
  "crypto_cost_basis",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    amountRemaining: bigint("amount_remaining", { mode: "bigint" }).notNull(),
    pricePerUnit: numeric("price_per_unit", {
      precision: 20,
      scale: 8,
    }).notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_crypto_cost_basis_player_token").on(
      table.playerMinecraftUuid,
      table.tokenId,
      table.acquiredAt,
    ),
  ],
);

// --- crypto_treasury ---
// Singleton row tracking cumulative trading fees collected and burned by the market.

export const cryptoTreasury = pgTable("crypto_treasury", {
  id: serial("id").primaryKey(),
  totalCollected: numeric("total_collected", { precision: 20, scale: 8 })
    .notNull()
    .default(sql`0`),
  totalBurned: numeric("total_burned", { precision: 20, scale: 8 })
    .notNull()
    .default(sql`0`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- crypto_price_alert ---
// Player-defined price alerts that fire once when a token crosses the target threshold.

export const cryptoPriceAlert = pgTable(
  "crypto_price_alert",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
    direction: cryptoAlertDirectionEnum("direction").notNull(),
    triggered: boolean("triggered").notNull().default(false),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_crypto_alert_pending")
      .on(table.tokenId, table.triggered)
      .where(sql`${table.triggered} = false`),
  ],
);

// --- crypto_watchlist ---
// Tokens a player has bookmarked for quick access; unique per player-token pair.

export const cryptoWatchlist = pgTable(
  "crypto_watchlist",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    tokenId: integer("token_id")
      .notNull()
      .references(() => cryptoToken.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_crypto_watchlist_unique").on(
      table.playerMinecraftUuid,
      table.tokenId,
    ),
  ],
);

// --- crypto_portfolio_snapshot ---
// Daily snapshots of a player's total portfolio value and P&L, used for the history chart.

export const cryptoPortfolioSnapshot = pgTable(
  "crypto_portfolio_snapshot",
  {
    id: serial("id").primaryKey(),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    totalValue: numeric("total_value", { precision: 20, scale: 8 }).notNull(),
    totalInvested: numeric("total_invested", {
      precision: 20,
      scale: 8,
    }).notNull(),
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 })
      .notNull()
      .default(sql`0`),
    tokenCount: integer("token_count").notNull().default(0),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_crypto_portfolio_snapshot_player").on(
      table.playerMinecraftUuid,
      table.recordedAt.desc(),
    ),
  ],
);

// --- crypto_market_event ---
// Market-wide or token-specific events surfaced in the news feed (e.g. crashes, listings, milestones).

export const cryptoMarketEvent = pgTable(
  "crypto_market_event",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    article: text("article"),
    tokenId: integer("token_id").references(() => cryptoToken.id, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
    severity: cryptoEventSeverityEnum("severity").notNull().default("info"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    activeUntil: timestamp("active_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_crypto_market_event_recent").on(table.createdAt.desc()),
  ],
);
