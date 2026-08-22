import {
  pgTable,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { modEnvironmentEnum, modEnvironmentSourceEnum } from "./enums";

// --- curseforge_project ---
// Global snapshot cache, one row per project ID. Deep content (descriptions,
// changelogs) is never mirrored; CurseForge stays the source of truth.

export const curseforgeProject = pgTable(
  "curseforge_project",
  {
    id: integer("id").primaryKey(),
    classId: integer("class_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
    thumbnailUrl: text("thumbnail_url"),
    websiteUrl: text("website_url"),
    primaryAuthor: text("primary_author"),
    categories: jsonb("categories")
      .notNull()
      .default(sql`'[]'::jsonb`),
    screenshots: jsonb("screenshots")
      .notNull()
      .default(sql`'[]'::jsonb`),
    downloadCount: integer("download_count").notNull().default(0),
    dateModified: timestamp("date_modified", { withTimezone: true }),
    dateReleased: timestamp("date_released", { withTimezone: true }),
    allowModDistribution: boolean("allow_mod_distribution"),
    isAvailable: boolean("is_available").notNull().default(true),
    // Which side(s) the mod runs on; unspecified ships to the client manifest
    // and to the server pack as well when the mod is on the test server.
    // Source tracks trust, manual > manifest > cf_flag: a manual admin flag is
    // never overwritten, a manifest value follows what the published pack's
    // client and server manifests shipped and only a publish or an admin can
    // change it, and a cf_flag value follows the author's tags but is kept if
    // they later drop them, so a classified mod never silently reverts; null
    // means no signal
    environment: modEnvironmentEnum("environment")
      .notNull()
      .default("unspecified"),
    environmentSource: modEnvironmentSourceEnum("environment_source"),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_curseforge_project_slug").on(table.slug),
    index("idx_curseforge_project_class").on(table.classId),
  ],
);
