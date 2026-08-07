import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  workshopStatusEnum,
  workshopModStatusEnum,
  workshopModRejectReasonEnum,
  workshopPollStatusEnum,
  workshopPollGranularityEnum,
} from "./enums";
import { curseforgeProject } from "./curseforge";
import { modpack } from "./modpack";

// --- workshop ---
// A workshop campaign (e.g. season modpack selection). classId scopes what kind
// of CurseForge project can be submitted (6 = mods, 4471 = modpacks).

export const workshop = pgTable(
  "workshop",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: workshopStatusEnum("status").notNull().default("draft"),
    gameVersion: text("game_version").notNull(),
    modLoaderType: integer("mod_loader_type").notNull(),
    classId: integer("class_id").notNull().default(6),
    // No FK to curseforge_project: the base pack may not be ingested yet when set
    baseModpackProjectId: integer("base_modpack_project_id"),
    modpackId: integer("modpack_id")
      .notNull()
      .references(() => modpack.id),
    maxModsPerUser: integer("max_mods_per_user").notNull().default(5),
    maxUpvotesPerUser: integer("max_upvotes_per_user").notNull().default(5),
    // Forum channel for per-suggestion discussion threads; null = no Discord
    // presence for this workshop. Deliberately per-row, not entity-scrape config
    discordForumChannelId: text("discord_forum_channel_id"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_workshop_status").on(table.status)],
);

// --- workshop_mod ---
// A community suggestion: someone's pitch for a mod, with votes, a discussion
// thread, and a review outcome. Pack membership lives in modpack_mod;
// approving a suggestion creates a modpack row linked back to it. File columns
// record which file satisfied the workshop's target at submit time; a pack
// build re-resolves files fresh rather than trusting this snapshot.

export const workshopMod = pgTable(
  "workshop_mod",
  {
    id: serial("id").primaryKey(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id, { onDelete: "cascade" }),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    submittedBy: text("submitted_by").notNull(),
    status: workshopModStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectReason: workshopModRejectReasonEnum("reject_reason"),
    rejectNote: text("reject_note"),
    fileId: integer("file_id"),
    fileName: text("file_name"),
    fileReleaseType: integer("file_release_type"),
    discordThreadId: text("discord_thread_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workshop_mod_workshop").on(table.workshopId),
    index("idx_workshop_mod_status").on(table.status),
    index("idx_workshop_mod_submitter").on(table.submittedBy),
    index("idx_workshop_mod_project").on(table.curseforgeProjectId),
    uniqueIndex("idx_workshop_mod_claim_unique").on(
      table.workshopId,
      table.curseforgeProjectId,
    ),
  ],
);

// --- workshop_project_dependency ---
// Resolved CurseForge dependencies of a project's chosen file within a
// workshop, keyed by project so suggestions and pack mods share one cache.
// relationType: 2 = optional, 3 = required. Deps satisfied by the base
// modpack are not stored.

export const workshopProjectDependency = pgTable(
  "workshop_project_dependency",
  {
    id: serial("id").primaryKey(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id, { onDelete: "cascade" }),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    dependsOnProjectId: integer("depends_on_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    relationType: integer("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workshop_project_dependency_workshop").on(table.workshopId),
    index("idx_workshop_project_dependency_target").on(
      table.workshopId,
      table.dependsOnProjectId,
    ),
    uniqueIndex("idx_workshop_project_dependency_unique").on(
      table.workshopId,
      table.curseforgeProjectId,
      table.dependsOnProjectId,
    ),
  ],
);

// --- workshop_mod_upvote ---

export const workshopModUpvote = pgTable(
  "workshop_mod_upvote",
  {
    id: serial("id").primaryKey(),
    workshopModId: integer("workshop_mod_id")
      .notNull()
      .references(() => workshopMod.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workshop_mod_upvote_player").on(table.discordId),
    uniqueIndex("idx_workshop_mod_upvote_unique").on(
      table.workshopModId,
      table.discordId,
    ),
  ],
);

// --- workshop_poll ---
// Admin-triggered timed poll over one or more workshop mods. Results are advisory,
// admins review outcomes after close.

export const workshopPoll = pgTable(
  "workshop_poll",
  {
    id: serial("id").primaryKey(),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshop.id, { onDelete: "cascade" }),
    title: text("title"),
    granularity: workshopPollGranularityEnum("granularity").notNull(),
    status: workshopPollStatusEnum("status").notNull().default("open"),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    discordChannelId: text("discord_channel_id"),
    discordMessageId: text("discord_message_id"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workshop_poll_workshop").on(table.workshopId),
    index("idx_workshop_poll_status").on(table.status),
    index("idx_workshop_poll_ends").on(table.endsAt),
  ],
);

// --- workshop_poll_mod ---

export const workshopPollMod = pgTable(
  "workshop_poll_mod",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => workshopPoll.id, { onDelete: "cascade" }),
    workshopModId: integer("workshop_mod_id")
      .notNull()
      .references(() => workshopMod.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("idx_workshop_poll_mod_unique").on(
      table.pollId,
      table.workshopModId,
    ),
  ],
);

// --- workshop_poll_ballot ---
// pollModId set = per-mod ballot, null = one ballot for the whole poll.

export const workshopPollBallot = pgTable(
  "workshop_poll_ballot",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => workshopPoll.id, { onDelete: "cascade" }),
    pollModId: integer("poll_mod_id").references(() => workshopPollMod.id, {
      onDelete: "cascade",
    }),
    discordId: text("discord_id").notNull(),
    choice: boolean("choice").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workshop_poll_ballot_poll").on(table.pollId),
    index("idx_workshop_poll_ballot_player").on(table.discordId),
    // NULLs are distinct in unique indexes, so per-mod and bundle ballots
    // each need their own partial uniqueness rule
    uniqueIndex("idx_workshop_poll_ballot_mod_unique")
      .on(table.pollId, table.pollModId, table.discordId)
      .where(sql`${table.pollModId} IS NOT NULL`),
    uniqueIndex("idx_workshop_poll_ballot_bundle_unique")
      .on(table.pollId, table.discordId)
      .where(sql`${table.pollModId} IS NULL`),
  ],
);
