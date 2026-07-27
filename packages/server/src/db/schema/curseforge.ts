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
// refreshed periodically. descriptionHtml is sanitized at ingest, never raw.

export const curseforgeProject = pgTable(
  "curseforge_project",
  {
    id: integer("id").primaryKey(),
    classId: integer("class_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
    logoUrl: text("logo_url"),
    thumbnailUrl: text("thumbnail_url"),
    websiteUrl: text("website_url"),
    primaryAuthor: text("primary_author"),
    authors: jsonb("authors")
      .notNull()
      .default(sql`'[]'::jsonb`),
    categories: jsonb("categories")
      .notNull()
      .default(sql`'[]'::jsonb`),
    links: jsonb("links")
      .notNull()
      .default(sql`'{}'::jsonb`),
    descriptionHtml: text("description_html"),
    screenshots: jsonb("screenshots")
      .notNull()
      .default(sql`'[]'::jsonb`),
    downloadCount: integer("download_count").notNull().default(0),
    gamePopularityRank: integer("game_popularity_rank"),
    dateCreated: timestamp("date_created", { withTimezone: true }),
    dateModified: timestamp("date_modified", { withTimezone: true }),
    dateReleased: timestamp("date_released", { withTimezone: true }),
    allowModDistribution: boolean("allow_mod_distribution"),
    isAvailable: boolean("is_available").notNull().default(true),
    cfStatus: integer("cf_status"),
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
