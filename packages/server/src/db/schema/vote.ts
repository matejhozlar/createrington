import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  voteStatusEnum,
  voteSubmissionStatusEnum,
  voteModStatusEnum,
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
    maxModsPerSubmission: integer("max_mods_per_submission")
      .notNull()
      .default(5),
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

// --- vote_submission ---

export const voteSubmission = pgTable(
  "vote_submission",
  {
    id: serial("id").primaryKey(),
    voteId: integer("vote_id")
      .notNull()
      .references(() => vote.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    status: voteSubmissionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vote_submission_vote").on(table.voteId),
    index("idx_vote_submission_player").on(table.discordId),
    // One active submission per player per vote; closed ones are unlimited
    uniqueIndex("idx_vote_submission_active_unique")
      .on(table.voteId, table.discordId)
      .where(sql`${table.status} = 'active'`),
  ],
);

// --- vote_mod ---
// A CurseForge project inside a vote. File columns snapshot the concrete file
// chosen for the vote's game version and loader at submit time.

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
    submissionId: integer("submission_id").references(() => voteSubmission.id, {
      onDelete: "set null",
    }),
    source: voteModSourceEnum("source").notNull().default("user"),
    submittedBy: text("submitted_by").notNull(),
    status: voteModStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    fileId: integer("file_id"),
    fileName: text("file_name"),
    fileDate: timestamp("file_date", { withTimezone: true }),
    fileLength: integer("file_length"),
    fileReleaseType: integer("file_release_type"),
    fileGameVersions: jsonb("file_game_versions")
      .notNull()
      .default(sql`'[]'::jsonb`),
    fileHashes: jsonb("file_hashes")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vote_mod_vote").on(table.voteId),
    index("idx_vote_mod_submission").on(table.submissionId),
    index("idx_vote_mod_status").on(table.status),
    index("idx_vote_mod_submitter").on(table.submittedBy),
    index("idx_vote_mod_project").on(table.curseforgeProjectId),
    // A project is claimed only while pending or approved; declined and
    // rejected rows stay for history and may be resubmitted by anyone
    uniqueIndex("idx_vote_mod_claim_unique")
      .on(table.voteId, table.curseforgeProjectId)
      .where(sql`${table.status} IN ('pending', 'approved')`),
  ],
);

// --- vote_mod_ban ---
// Global permanent rejection list, survives across votes. Un-ban by deleting.

export const voteModBan = pgTable("vote_mod_ban", {
  id: serial("id").primaryKey(),
  curseforgeProjectId: integer("curseforge_project_id")
    .notNull()
    .unique()
    .references(() => curseforgeProject.id),
  reason: text("reason"),
  bannedBy: text("banned_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- vote_submission_upvote ---

export const voteSubmissionUpvote = pgTable(
  "vote_submission_upvote",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => voteSubmission.id, { onDelete: "cascade" }),
    discordId: text("discord_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vote_submission_upvote_player").on(table.discordId),
    uniqueIndex("idx_vote_submission_upvote_unique").on(
      table.submissionId,
      table.discordId,
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
