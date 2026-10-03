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
import {
  curseforgeFileSourceEnum,
  modEnvironmentEnum,
  modEnvironmentSourceEnum,
} from "./enums";

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
    // never overwritten, a manifest value is a CurseForge hint confirmed by
    // the side(s) the published pack shipped the mod to and only a publish or
    // an admin can change it, and a cf_flag value follows the author's tags
    // but is kept if they later drop them, so a classified mod never silently
    // reverts; null means no signal, and the pack never turns that into one
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

// --- curseforge_file ---
// How the launcher gets one CurseForge file, keyed by the file id. Resolved
// once when a release is ingested (or on request for a file no release
// ships) and read from here afterwards: a published file never changes and
// CurseForge drops archived files. sha1 and fileSize are always CurseForge's
// values, whichever source serves the bytes. downloadUrl is null for manual.
// A manual row is looked up again later, since a source can appear.

export const curseforgeFile = pgTable(
  "curseforge_file",
  {
    id: integer("id").primaryKey(),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    sha1: text("sha1").notNull(),
    source: curseforgeFileSourceEnum("source").notNull(),
    downloadUrl: text("download_url"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_curseforge_file_project").on(table.curseforgeProjectId),
  ],
);
