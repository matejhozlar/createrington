import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { launcherPackSourceEnum, launcherReleaseStatusEnum } from "./enums";
import { modpack } from "./modpack";

// --- launcher_pack ---
// One row per modpack the launcher offers, owner-managed. slug is the key a
// launcher stores with an installed instance and never changes once a row
// exists. source says where the modpack's releases come from. A modpack a row
// points at cannot be deleted and its CurseForge project cannot be relinked;
// the owner changes the row instead. enabled false hides the pack from the
// list and refuses its endpoints while keeping its releases prepared.
// position orders the list, lowest first.

export const launcherPack = pgTable(
  "launcher_pack",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    modpackId: integer("modpack_id")
      .notNull()
      .references(() => modpack.id, { onDelete: "restrict" }),
    source: launcherPackSourceEnum("source").notNull(),
    position: integer("position").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_launcher_pack_slug").on(table.slug),
    unique("uq_launcher_pack_modpack").on(table.modpackId),
  ],
);

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
    // The same notes as summary plus typed changes, for pages that render
    // them. Null for a release announced without them.
    structuredNotes: jsonb("structured_notes"),
    pubDate: timestamp("pub_date", { withTimezone: true }).notNull(),
    status: launcherReleaseStatusEnum("status").notNull().default("pending"),
    // Set when the owner releases the version as required. The newest
    // released required version is the oldest launcher the app still serves.
    required: boolean("required").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedByDiscordId: text("released_by_discord_id"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnByDiscordId: text("withdrawn_by_discord_id"),
    // Set when the launcher's CI reported that the file is no longer on the
    // bucket. The status is pruned from then on, whatever it was before.
    prunedAt: timestamp("pruned_at", { withTimezone: true }),
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
