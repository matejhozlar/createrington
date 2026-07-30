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
  voteStatusEnum,
  voteModStatusEnum,
  voteModRejectReasonEnum,
  voteModSourceEnum,
  votePollStatusEnum,
  votePollGranularityEnum,
} from "./enums";
import { curseforgeProject } from "./curseforge";

// --- vote ---
// A voting campaign (e.g. season modpack selection). classId scopes what kind
// of CurseForge project can be submitted (6 = mods, 4471 = modpacks).

export const vote = pgTable(
  "vote",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: voteStatusEnum("status").notNull().default("draft"),
    gameVersion: text("game_version").notNull(),
    modLoaderType: integer("mod_loader_type").notNull(),
    classId: integer("class_id").notNull().default(6),
    baseModpackProjectId: integer("base_modpack_project_id"),
    maxModsPerUser: integer("max_mods_per_user").notNull().default(5),
    maxUpvotesPerUser: integer("max_upvotes_per_user").notNull().default(5),
    closesAt: timestamp("closes_at", { withTimezone: true }),
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
  (table) => [index("idx_vote_status").on(table.status)],
);

// --- vote_mod ---
// A CurseForge project inside a vote. File columns record which file satisfied
// the vote's game version and loader at submit time; a pack build re-resolves
// files fresh rather than trusting this snapshot.

export const voteMod = pgTable(
  "vote_mod",
  {
    id: serial("id").primaryKey(),
    voteId: integer("vote_id")
      .notNull()
      .references(() => vote.id, { onDelete: "cascade" }),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    source: voteModSourceEnum("source").notNull().default("user"),
    submittedBy: text("submitted_by").notNull(),
    status: voteModStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectReason: voteModRejectReasonEnum("reject_reason"),
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
    index("idx_vote_mod_vote").on(table.voteId),
    index("idx_vote_mod_status").on(table.status),
    index("idx_vote_mod_submitter").on(table.submittedBy),
    index("idx_vote_mod_project").on(table.curseforgeProjectId),
    uniqueIndex("idx_vote_mod_claim_unique").on(
      table.voteId,
      table.curseforgeProjectId,
    ),
  ],
);

// --- vote_mod_dependency ---
// Resolved CurseForge dependencies of a suggestion's chosen file, refreshed
// lazily in the background. relationType: 2 = optional, 3 = required.
// Deps satisfied by the base modpack are not stored.

export const voteModDependency = pgTable(
  "vote_mod_dependency",
  {
    id: serial("id").primaryKey(),
    voteModId: integer("vote_mod_id")
      .notNull()
      .references(() => voteMod.id, { onDelete: "cascade" }),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    relationType: integer("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vote_mod_dependency_mod").on(table.voteModId),
    uniqueIndex("idx_vote_mod_dependency_unique").on(
      table.voteModId,
      table.curseforgeProjectId,
    ),
  ],
);

// --- vote_mod_upvote ---

export const voteModUpvote = pgTable(
  "vote_mod_upvote",
  {
    id: serial("id").primaryKey(),
    voteModId: integer("vote_mod_id")
      .notNull()
      .references(() => voteMod.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vote_mod_upvote_player").on(table.discordId),
    uniqueIndex("idx_vote_mod_upvote_unique").on(
      table.voteModId,
      table.discordId,
    ),
  ],
);

// --- vote_poll ---
// Admin-triggered timed poll over one or more vote mods. Results are advisory,
// admins review outcomes after close.

export const votePoll = pgTable(
  "vote_poll",
  {
    id: serial("id").primaryKey(),
    voteId: integer("vote_id")
      .notNull()
      .references(() => vote.id, { onDelete: "cascade" }),
    title: text("title"),
    granularity: votePollGranularityEnum("granularity").notNull(),
    status: votePollStatusEnum("status").notNull().default("open"),
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
    index("idx_vote_poll_vote").on(table.voteId),
    index("idx_vote_poll_status").on(table.status),
    index("idx_vote_poll_ends").on(table.endsAt),
  ],
);

// --- vote_poll_mod ---

export const votePollMod = pgTable(
  "vote_poll_mod",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => votePoll.id, { onDelete: "cascade" }),
    voteModId: integer("vote_mod_id")
      .notNull()
      .references(() => voteMod.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("idx_vote_poll_mod_unique").on(table.pollId, table.voteModId),
  ],
);

// --- vote_poll_ballot ---
// pollModId set = per-mod ballot, null = one ballot for the whole poll.

export const votePollBallot = pgTable(
  "vote_poll_ballot",
  {
    id: serial("id").primaryKey(),
    pollId: integer("poll_id")
      .notNull()
      .references(() => votePoll.id, { onDelete: "cascade" }),
    pollModId: integer("poll_mod_id").references(() => votePollMod.id, {
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
    index("idx_vote_poll_ballot_poll").on(table.pollId),
    index("idx_vote_poll_ballot_player").on(table.discordId),
    // NULLs are distinct in unique indexes, so per-mod and bundle ballots
    // each need their own partial uniqueness rule
    uniqueIndex("idx_vote_poll_ballot_mod_unique")
      .on(table.pollId, table.pollModId, table.discordId)
      .where(sql`${table.pollModId} IS NOT NULL`),
    uniqueIndex("idx_vote_poll_ballot_bundle_unique")
      .on(table.pollId, table.discordId)
      .where(sql`${table.pollModId} IS NULL`),
  ],
);
