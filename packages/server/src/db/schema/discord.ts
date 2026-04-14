import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  varchar,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { discordAutoMessageRotationEnum } from "./enums";

// --- discord_embed_preset_category ---

export const discordEmbedPresetCategory = pgTable(
  "discord_embed_preset_category",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// --- discord_embed_preset ---

export const discordEmbedPreset = pgTable("discord_embed_preset", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  data: jsonb("data").notNull(),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  categoryId: integer("category_id").references(
    () => discordEmbedPresetCategory.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- discord_embed_preset_message ---

export const discordEmbedPresetMessage = pgTable(
  "discord_embed_preset_message",
  {
    id: serial("id").primaryKey(),
    presetId: integer("preset_id")
      .notNull()
      .references(() => discordEmbedPreset.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_discord_embed_preset_message_preset").on(table.presetId),
    uniqueIndex("idx_discord_embed_preset_message_unique").on(
      table.channelId,
      table.messageId,
    ),
  ],
);

// --- discord_guild_member_join ---

export const discordGuildMemberJoin = pgTable(
  "discord_guild_member_join",
  {
    joinNumber: serial("join_number").primaryKey(),
    userId: varchar("user_id", { length: 32 }).notNull().unique(),
    username: varchar("username", { length: 32 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_discord_guild_member_join_joined_at").on(table.joinedAt.desc()),
  ],
);

// --- discord_guild_member_leave ---

export const discordGuildMemberLeave = pgTable(
  "discord_guild_member_leave",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    minecraftUuid: uuid("minecraft_uuid").notNull(),
    minecraftUsername: text("minecraft_username").notNull(),
    departedAt: timestamp("departed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notificationMessageId: text("notification_message_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_discord_guild_member_leave_discord_id").on(table.discordId),
    index("idx_discord_guild_member_leave_minecraft_uuid").on(
      table.minecraftUuid,
    ),
    index("idx_discord_guild_member_leave_departed_at").on(table.departedAt),
    index("idx_discord_guild_member_leave_deleted_at")
      .on(table.deletedAt)
      .where(sql`deleted_at IS NULL`),
  ],
);

// --- discord_command_usage ---

export const discordCommandUsage = pgTable(
  "discord_command_usage",
  {
    id: serial("id").primaryKey(),
    commandName: varchar("command_name", { length: 100 }).notNull(),
    discordId: varchar("discord_id", { length: 50 }).notNull(),
    success: boolean("success").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_discord_command_usage_command").on(table.commandName),
    index("idx_discord_command_usage_executed_at").on(table.executedAt),
  ],
);

// --- discord_auto_message_config ---

export const discordAutoMessageConfig = pgTable("discord_auto_message_config", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  rotationMode: discordAutoMessageRotationEnum("rotation_mode")
    .notNull()
    .default("sequential"),
  currentIndex: integer("current_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- discord_auto_message ---

export const discordAutoMessage = pgTable(
  "discord_auto_message",
  {
    id: serial("id").primaryKey(),
    configId: integer("config_id")
      .notNull()
      .references(() => discordAutoMessageConfig.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_discord_auto_message_config_id").on(table.configId),
    index("idx_discord_auto_message_sort").on(table.configId, table.sortOrder),
  ],
);
