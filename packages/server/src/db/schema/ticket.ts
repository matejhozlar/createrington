import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { ticketStatusEnum, ticketTypeEnum } from "./enums";

// --- ticket ---

export const ticket = pgTable(
  "ticket",
  {
    id: serial("id").primaryKey(),
    ticketNumber: integer("ticket_number").notNull(),
    type: ticketTypeEnum("type").notNull(),
    creatorDiscordId: text("creator_discord_id").notNull(),
    channelId: text("channel_id").notNull().unique(),
    status: ticketStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByDiscordId: text("closed_by_discord_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
  },
  (table) => [
    index("idx_ticket_creator").on(table.creatorDiscordId),
    index("idx_ticket_status").on(table.status),
    index("idx_ticket_type").on(table.type),
  ],
);

// --- ticket_action ---

export const ticketAction = pgTable(
  "ticket_action",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    performedByDiscordId: text("performed_by_discord_id").notNull(),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => [
    index("idx_ticket_action_ticket").on(table.ticketId),
    index("idx_ticket_action_type").on(table.actionType),
  ],
);
