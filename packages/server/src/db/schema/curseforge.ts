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

// --- curseforge_project ---
// Global snapshot cache of CurseForge project metadata, one row per project ID.
// Ingested when a project is first referenced (submission, admin add, ban) and
// refreshed periodically. Deep content (descriptions, changelogs) is never
// mirrored; the CurseForge page stays the source of truth for it.

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
