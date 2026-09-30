import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { launcherReleaseStatusEnum } from "./enums";

// --- launcher_release ---

export const launcherRelease = pgTable(
  "launcher_release",
  {
    id: serial("id").primaryKey(),
    version: text("version").notNull(),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    signature: text("signature").notNull(),
    notes: text("notes").notNull().default(""),
    pubDate: timestamp("pub_date", { withTimezone: true }).notNull(),
    status: launcherReleaseStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedByDiscordId: text("released_by_discord_id"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnByDiscordId: text("withdrawn_by_discord_id"),
  },
  (table) => [
    unique("uq_launcher_release_platform_version").on(
      table.platform,
      table.version,
    ),
    index("idx_launcher_release_platform_status").on(
      table.platform,
      table.status,
    ),
  ],
);
