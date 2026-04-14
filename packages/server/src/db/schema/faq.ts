import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- faq_entry ---

export const faqEntry = pgTable(
  "faq_entry",
  {
    id: serial("id").primaryKey(),
    matchMode: varchar("match_mode", { length: 20 })
      .notNull()
      .default("keywords"),
    pattern: text("pattern").notNull(),
    title: varchar("title", { length: 100 }).notNull(),
    response: text("response").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_faq_entry_enabled").on(table.enabled),
    index("idx_faq_entry_priority").on(table.priority.desc()),
  ],
);

// --- faq_welcome_message ---

export const faqWelcomeMessage = pgTable("faq_welcome_message", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  messageId: text("message_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
