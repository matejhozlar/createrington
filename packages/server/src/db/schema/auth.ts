import {
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  inet,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { player } from "./player";

// --- auth_session ---

export const authSession = pgTable(
  "auth_session",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id")
      .notNull()
      .references(() => player.discordId, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    discordUsername: text("discord_username"),
    discordAvatar: text("discord_avatar"),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: uuid("family_id")
      .notNull()
      .default(sql`gen_random_uuid()`),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_auth_session_discord_id").on(table.discordId),
    index("idx_auth_session_token_hash")
      .on(table.tokenHash)
      .where(sql`revoked_at IS NULL`),
    index("idx_auth_session_expires_at")
      .on(table.expiresAt)
      .where(sql`revoked_at IS NULL`),
    index("idx_auth_session_family_id").on(table.familyId),
  ],
);
