import {
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { player } from "./player";
import { playerPromptStatusEnum } from "./enums";

// Player Prompt
//
// Admin-authored free-text question posted to a Discord channel with a
// "Respond" button. Clicking the button opens a modal; the submitted text
// is stored in player_prompt_response keyed on (prompt_id, discord_id) so
// a player can edit their answer until the prompt closes.

export const playerPrompt = pgTable(
  "player_prompt",
  {
    id: serial("id").primaryKey(),
    question: text("question").notNull(),
    description: text("description"),
    // Discord id of the admin who created the prompt. No FK: admins are
    // identified by discord_id, not stored as a first-class entity here.
    createdBy: text("created_by").notNull(),
    channelId: text("channel_id").notNull(),
    // Set after the bot successfully posts the announcement embed.
    messageId: text("message_id"),
    rolePingId: text("role_ping_id"),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: playerPromptStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_player_prompt_status").on(table.status),
    index("idx_player_prompt_ends_at").on(table.endsAt),
  ],
);

// Player Prompt Response
//
// One row per (prompt, Discord user). Editable until the parent prompt
// closes: the service upserts on the unique index. minecraftUuid is
// resolved opportunistically at submission time via Q.player.find so
// admins can see the linked Minecraft account when it exists; null means
// the responder hasn't linked their Discord to a Minecraft account yet.

export const playerPromptResponse = pgTable(
  "player_prompt_response",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => playerPrompt.id, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    discordId: text("discord_id").notNull(),
    minecraftUuid: uuid("minecraft_uuid").references(
      () => player.minecraftUuid,
      { onUpdate: "cascade", onDelete: "set null" },
    ),
    responseText: text("response_text").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_player_prompt_response_prompt_discord").on(
      table.promptId,
      table.discordId,
    ),
    index("idx_player_prompt_response_prompt_id").on(table.promptId),
    index("idx_player_prompt_response_minecraft_uuid").on(table.minecraftUuid),
  ],
);
