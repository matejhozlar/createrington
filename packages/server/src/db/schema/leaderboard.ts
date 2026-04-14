import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- leaderboard_message ---

export const leaderboardMessage = pgTable(
  "leaderboard_message",
  {
    id: serial("id").primaryKey(),
    leaderboardType: varchar("leaderboard_type", { length: 50 })
      .notNull()
      .unique(),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    lastRefreshed: timestamp("last_refreshed", {
      withTimezone: true,
    }).defaultNow(),
    lastManualRefresh: timestamp("last_manual_refresh", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_leaderboard_type").on(table.leaderboardType)],
);
