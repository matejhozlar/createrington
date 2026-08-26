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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

// --- server_forceload_player ---
// Solo players (not in a party, or in a non-opted-in party) whose forceloadable
// chunks are currently being tracked on a server. One row per (server, player).

export const serverForceloadPlayer = pgTable(
  "server_forceload_player",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    playerUuid: uuid("player_uuid").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_forceload_player_unique").on(
      table.serverId,
      table.playerUuid,
    ),
    index("idx_server_forceload_player_server").on(table.serverId),
  ],
);

// --- server_forceload_party ---
// Parties that have opted in to shared forceloading on a server. One row per
// (server, party).

export const serverForceloadParty = pgTable(
  "server_forceload_party",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    partyId: uuid("party_id").notNull(),
    partyName: varchar("party_name", { length: 255 }).notNull(),
    memberCount: integer("member_count").notNull(),
    optedIn: boolean("opted_in").notNull().default(true),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_forceload_party_unique").on(
      table.serverId,
      table.partyId,
    ),
    index("idx_server_forceload_party_server").on(table.serverId),
  ],
);

// --- server_forceload_member ---
// Members of opted-in forceload parties.

export const serverForceloadMember = pgTable(
  "server_forceload_member",
  {
    id: serial("id").primaryKey(),
    partyId: integer("party_id")
      .notNull()
      .references(() => serverForceloadParty.id, { onDelete: "cascade" }),
    playerUuid: uuid("player_uuid").notNull(),
  },
  (table) => [
    index("idx_server_forceload_member_party").on(table.partyId),
    index("idx_server_forceload_member_player").on(table.playerUuid),
  ],
);

// --- server_forceload_chunk ---
// Forceloadable chunks. Exactly one of player_id or party_id is non-null
// (enforced via check constraint): chunks either belong to a solo player row
// or to an opted-in party row.

export const serverForceloadChunk = pgTable(
  "server_forceload_chunk",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id").references(() => serverForceloadPlayer.id, {
      onDelete: "cascade",
    }),
    partyId: integer("party_id").references(() => serverForceloadParty.id, {
      onDelete: "cascade",
    }),
    dimension: varchar("dimension", { length: 255 }).notNull(),
    x: integer("x").notNull(),
    z: integer("z").notNull(),
    active: boolean("active").notNull(),
  },
  (table) => [
    check(
      "chk_forceload_chunk_owner",
      sql`(${table.playerId} IS NULL) <> (${table.partyId} IS NULL)`,
    ),
    index("idx_server_forceload_chunk_player").on(table.playerId),
    index("idx_server_forceload_chunk_party").on(table.partyId),
  ],
);

// --- server_chunk ---
// All claimed chunks per player, synced from opac-teams. Unique per chunk
// coordinate within a server: ownership is just a column, so transfers
// update player_uuid in place. original_player_uuid is sticky: set on first
// insert, never overwritten. Orphan sweep by last_synced_at timestamp.

/**
 * Sentinel UUID emitted by opac-fakeplayer for chunks whose original owner has
 * let their claim lapse (an "expired claim"). Can appear in either
 * `serverChunk.playerUuid` or `serverChunk.originalPlayerUuid` and does NOT
 * correspond to any real player. Filter it out wherever real-player attribution
 * is expected (leaderboards, per-player aggregates, attribution joins, etc.).
 */
export const EXPIRED_CLAIM_UUID = "00000000-0000-0000-0000-000000000001";

export const serverChunk = pgTable(
  "server_chunk",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    dimension: varchar("dimension", { length: 255 }).notNull(),
    x: integer("x").notNull(),
    z: integer("z").notNull(),
    // Current owner. May equal EXPIRED_CLAIM_UUID for orphaned/expired claims.
    playerUuid: uuid("player_uuid").notNull(),
    // First-seen owner (sticky, never updated). May equal EXPIRED_CLAIM_UUID.
    originalPlayerUuid: uuid("original_player_uuid").notNull(),
    partyId: uuid("party_id"),
    partyName: varchar("party_name", { length: 255 }),
    partyOptedIn: boolean("party_opted_in"),
    forceloadable: boolean("forceloadable").notNull().default(false),
    active: boolean("active").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_chunk_unique").on(
      table.serverId,
      table.dimension,
      table.x,
      table.z,
    ),
    index("idx_server_chunk_player").on(table.playerUuid),
    index("idx_server_chunk_party").on(table.partyId),
  ],
);

// --- server_ally_fake_party ---
// Snapshot of the opac-fakeplayer fake-player party for a server. One row per
// server; replaced on each sync.

export const serverAllyFakeParty = pgTable(
  "server_ally_fake_party",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    partyId: uuid("party_id").notNull(),
    ownerUuid: uuid("owner_uuid").notNull(),
    ownerName: varchar("owner_name", { length: 255 }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_ally_fake_party_server").on(table.serverId),
  ],
);

// --- server_ally_fake_party_member ---
// Members of the fake-player party.

export const serverAllyFakePartyMember = pgTable(
  "server_ally_fake_party_member",
  {
    id: serial("id").primaryKey(),
    fakePartyId: integer("fake_party_id")
      .notNull()
      .references(() => serverAllyFakeParty.id, { onDelete: "cascade" }),
    playerUuid: uuid("player_uuid").notNull(),
  },
  (table) => [
    index("idx_server_ally_fake_party_member_party").on(table.fakePartyId),
    index("idx_server_ally_fake_party_member_player").on(table.playerUuid),
  ],
);

// --- server_ally_party ---
// Real-player parties currently allied with the fake-player party on a server.
// One row per (server, party).

export const serverAllyParty = pgTable(
  "server_ally_party",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    partyId: uuid("party_id").notNull(),
    alliedAt: timestamp("allied_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_ally_party_unique").on(
      table.serverId,
      table.partyId,
    ),
    index("idx_server_ally_party_server").on(table.serverId),
  ],
);

// --- server_ally_qualified_player ---
// Players who have met the ally trigger requirements (advancement unlock or
// playtime threshold). isPending is true when the player has qualified but is
// not yet in any allied party.

export const serverAllyQualifiedPlayer = pgTable(
  "server_ally_qualified_player",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    playerUuid: uuid("player_uuid").notNull(),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }).notNull(),
    isPending: boolean("is_pending").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_server_ally_qualified_player_unique").on(
      table.serverId,
      table.playerUuid,
    ),
    index("idx_server_ally_qualified_player_server").on(table.serverId),
  ],
);
