import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  varchar,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { partyMemberRankEnum } from "./enums";

// --- server (referenced by many tables) ---

export const server = pgTable("server", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  identifier: text("identifier").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- server_maintenance_schedule ---
// One row per maintenance window, whether scheduled ahead of time or started
// instantly (scheduled_at = started_at). Status transitions:
// scheduled → active → completed | cancelled. applied_at records when the
// Maintenance Mode mod confirmed the window over RCON; an active row with
// applied_at NULL is still waiting for the game server to become reachable.
// estimated_minutes is NULL for instant windows.

export const serverMaintenanceSchedule = pgTable(
  "server_maintenance_schedule",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id),
    status: text("status").notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    // Mod-side `schedule untilRestart`: the mod turns itself off at the next
    // server stop, which the reconciler then mirrors into this row.
    untilRestart: boolean("until_restart").notNull().default(false),
    scheduledByDiscordId: text("scheduled_by_discord_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_server_maintenance_schedule_server_status").on(
      table.serverId,
      table.status,
    ),
    // At most one open (scheduled or active) window per server.
    uniqueIndex("idx_server_maintenance_schedule_open")
      .on(table.serverId)
      .where(sql`${table.status} IN ('scheduled', 'active')`),
  ],
);

// --- server_maintenance_setting ---
// Per-server Maintenance Mode presentation pushed to the mod over RCON
// (`maintenance setMotd` / `setMessage`). NULL means "use the built-in
// preset". One row per server, created lazily on first edit.

export const serverMaintenanceSetting = pgTable(
  "server_maintenance_setting",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    // MOTD shown in the server list while maintenance is on. Legacy & colour
    // codes plus newlines; the app translates & to § before pushing (the
    // mod's MiniMessage path is unreliable, see services/maintenance/mmode.ts).
    motd: text("motd"),
    // Kick / join-denied message shown to players who are not allowed in.
    message: text("message"),
    updatedByDiscordId: text("updated_by_discord_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_maintenance_setting_server").on(table.serverId),
  ],
);

// --- server_maintenance_allowed_player ---
// Players allowed to join while maintenance is on, on top of admins (admins
// are derived from the admin table at sync time and never stored here). The
// mod keeps its own copy in mmode.json; this table is the source of truth the
// backend reconciles it against. One row per (server, player).

export const serverMaintenanceAllowedPlayer = pgTable(
  "server_maintenance_allowed_player",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    playerUuid: uuid("player_uuid").notNull(),
    addedByDiscordId: text("added_by_discord_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_maintenance_allowed_player_unique").on(
      table.serverId,
      table.playerUuid,
    ),
    index("idx_server_maintenance_allowed_player_server").on(table.serverId),
  ],
);

// --- server_party ---
// FTB Teams parties as core reports them (party_sync). One row per
// (server, party), upserted by team_id so id and first_seen_at survive syncs;
// parties missing from a snapshot are deleted and synced_at is the last
// snapshot that carried the party. tag_code is the team tag design
// code (CRP1:...) and tag its 4 letters, both NULL when the party has no tag or
// core sent a code that does not parse. No foreign key to player on the UUID
// columns of these tables: they join player at read time where a row exists.

export const serverParty = pgTable(
  "server_party",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    // RGB packed into one int, as FTB Teams stores it
    color: integer("color").notNull(),
    freeToJoin: boolean("free_to_join").notNull().default(false),
    ownerUuid: uuid("owner_uuid").notNull(),
    tagCode: text("tag_code"),
    tag: varchar("tag", { length: 4 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_party_unique").on(table.serverId, table.teamId),
    index("idx_server_party_tag").on(table.serverId, table.tag),
  ],
);

// --- server_party_member ---
// Party members with their FTB Teams rank. claim_count and forceload_count are
// the OPAC counters of that player as OPAC reports them: with party-owned
// claims (the server's setting) the party's claims sit under its owner, so a
// party total is the sum over its members. NULL when OPAC is not installed.

export const serverPartyMember = pgTable(
  "server_party_member",
  {
    id: serial("id").primaryKey(),
    partyId: integer("party_id")
      .notNull()
      .references(() => serverParty.id, { onDelete: "cascade" }),
    minecraftUuid: uuid("minecraft_uuid").notNull(),
    rank: partyMemberRankEnum("rank").notNull(),
    claimCount: integer("claim_count"),
    forceloadCount: integer("forceload_count"),
  },
  (table) => [
    uniqueIndex("idx_server_party_member_unique").on(
      table.partyId,
      table.minecraftUuid,
    ),
    index("idx_server_party_member_player").on(table.minecraftUuid),
  ],
);

// --- server_party_ally ---
// Players holding the FTB Teams ally rank in a party (allies are players, not
// parties, in FTB Teams).

export const serverPartyAlly = pgTable(
  "server_party_ally",
  {
    id: serial("id").primaryKey(),
    partyId: integer("party_id")
      .notNull()
      .references(() => serverParty.id, { onDelete: "cascade" }),
    minecraftUuid: uuid("minecraft_uuid").notNull(),
  },
  (table) => [
    uniqueIndex("idx_server_party_ally_unique").on(
      table.partyId,
      table.minecraftUuid,
    ),
    index("idx_server_party_ally_player").on(table.minecraftUuid),
  ],
);
