import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { player } from "./player";

// --- admin ---

export const admin = pgTable("admin", {
  discordId: text("discord_id")
    .primaryKey()
    .references(() => player.discordId, {
      onUpdate: "cascade",
      onDelete: "cascade",
    }),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
  vanished: boolean("vanished").default(false),
});

// --- admin_log_action ---

export const adminLogAction = pgTable(
  "admin_log_action",
  {
    id: serial("id").primaryKey(),
    adminDiscordId: text("admin_discord_id").notNull(),
    adminUsername: text("admin_username").notNull(),
    actionType: text("action_type").notNull(),
    description: text("description"),
    targetPlayerUuid: uuid("target_player_uuid"),
    targetPlayerName: text("target_player_name"),
    tableName: text("table_name"),
    fieldName: text("field_name"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    serverId: integer("server_id"),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_log_actions_admin").on(table.adminDiscordId),
    index("idx_log_actions_action_type").on(table.actionType),
    index("idx_log_actions_table_name").on(table.tableName),
    index("idx_log_actions_target").on(table.targetPlayerUuid),
    index("idx_log_actions_performed_at").on(table.performedAt.desc()),
  ],
);
