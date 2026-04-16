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
// Tracks scheduled and in-progress maintenance windows. One row per event;
// status transitions: scheduled → active → completed | cancelled.

export const serverMaintenanceSchedule = pgTable(
  "server_maintenance_schedule",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => server.id),
    status: text("status").notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
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
