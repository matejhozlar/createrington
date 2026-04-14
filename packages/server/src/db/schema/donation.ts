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
import { player } from "./player";
import { donationTypeEnum } from "./enums";

// =============================================================================
// DONATIONS
// =============================================================================

export const donation = pgTable(
  "donation",
  {
    id: serial("id").primaryKey(),
    playerDiscordId: text("player_discord_id")
      .notNull()
      .references(() => player.discordId, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    type: donationTypeEnum("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("eur"),
    stripeSessionId: text("stripe_session_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").notNull().default("pending"),
    supporterRoleGranted: boolean("supporter_role_granted")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_donation_player").on(table.playerDiscordId),
    index("idx_donation_stripe_session").on(table.stripeSessionId),
    index("idx_donation_created_at").on(table.createdAt.desc()),
  ],
);
