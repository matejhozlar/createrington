import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { waitlistStatusEnum } from "./enums";

// --- waitlist_entry ---
// Discord-born waitlist queue: every entry is created from inside the guild,
// so discord_id is always known. Lifecycle: queued -> promoted (slot
// reserved, may re-queue on timeout) -> registered; expired is terminal
// (left the guild, left the queue, or removed by an admin).

export const waitlistEntry = pgTable(
  "waitlist_entry",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull().unique(),
    discordUsername: text("discord_username").notNull(),
    status: waitlistStatusEnum("status").notNull().default("queued"),
    // First time this member entered intake. Never rewritten, so signup
    // stats stay honest across re-queues and rejoins.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Position in the queue: reset every time the entry goes back in line
    // (stale-promotion recycle, expired/player-less rejoin).
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    promotedBy: text("promoted_by"),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    joinedMinecraft: boolean("joined_minecraft").notNull().default(false),
    verifyChannelId: text("verify_channel_id"),
    waitingMessageId: text("waiting_message_id"),
    adminMessageId: text("admin_message_id"),
  },
  (table) => [
    index("idx_waitlist_status").on(table.status),
    index("idx_waitlist_queued_at").on(table.queuedAt),
  ],
);
