import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { waitlistStatusEnum } from "./enums";

// --- waitlist_entry ---

export const waitlistEntry = pgTable(
  "waitlist_entry",
  {
    id: serial("id").primaryKey(),
    email: text("email"),
    discordName: text("discord_name").unique(),
    discordId: text("discord_id").unique(),
    inviteCode: text("invite_code").unique(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    discordMessageId: text("discord_message_id"),
    status: waitlistStatusEnum("status").notNull().default("pending"),
    joinedDiscord: boolean("joined_discord").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    registered: boolean("registered").notNull().default(false),
    joinedMinecraft: boolean("joined_minecraft").notNull().default(false),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_waitlist_discord_message_id").on(table.discordMessageId),
    index("idx_waitlist_status").on(table.status),
    index("idx_waitlist_submitted_at").on(table.submittedAt),
  ],
);
