import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { modpackModOriginEnum } from "./enums";
import { curseforgeProject } from "./curseforge";
import { server } from "./server";
import { workshopMod } from "./workshop";

// --- modpack ---
// curseforgeProjectId points at the published CurseForge pack and stays null
// until its first publish; live state of members derives from its manifest.
// shipsServerPack flips on the first release read together with a server
// pack; from then on a client-only read is refused instead of applied, since
// it would drop every server-side member.

export const modpack = pgTable(
  "modpack",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    curseforgeProjectId: integer("curseforge_project_id"),
    shipsServerPack: boolean("ships_server_pack").notNull().default(false),
    serverId: integer("server_id").references(() => server.id),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_modpack_project_unique").on(table.curseforgeProjectId),
  ],
);

// --- modpack_mod ---
// liveAt set = shipped in the published pack, droppedFromManifestAt set = was
// live but missing from the latest published version (admin attention).
// required mirrors the manifest entry flag: false = the mod ships in the pack
// but is disabled (the CurseForge app exports disabled profile mods that way).

export const modpackMod = pgTable(
  "modpack_mod",
  {
    id: serial("id").primaryKey(),
    modpackId: integer("modpack_id")
      .notNull()
      .references(() => modpack.id, { onDelete: "cascade" }),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    origin: modpackModOriginEnum("origin").notNull(),
    workshopModId: integer("workshop_mod_id").references(() => workshopMod.id, {
      onDelete: "set null",
    }),
    addedBy: text("added_by"),
    fileId: integer("file_id"),
    fileName: text("file_name"),
    fileReleaseType: integer("file_release_type"),
    required: boolean("required").notNull().default(true),
    liveAt: timestamp("live_at", { withTimezone: true }),
    liveInVersion: text("live_in_version"),
    droppedFromManifestAt: timestamp("dropped_from_manifest_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_modpack_mod_modpack").on(table.modpackId),
    index("idx_modpack_mod_suggestion").on(table.workshopModId),
    index("idx_modpack_mod_project").on(table.curseforgeProjectId),
    uniqueIndex("idx_modpack_mod_unique").on(
      table.modpackId,
      table.curseforgeProjectId,
    ),
  ],
);

// --- modpack_publish ---
// What the sandbox reported after publishing a release: the client file and
// the server pack it uploaded, both live on CurseForge. The CurseForge API
// never links a server pack uploaded through it, so reconcile reads the
// reported pair directly. ingestedAt set = the release was read from both
// files; lastError keeps the last refusal for the sandbox to show.

export const modpackPublish = pgTable(
  "modpack_publish",
  {
    id: serial("id").primaryKey(),
    modpackId: integer("modpack_id")
      .notNull()
      .references(() => modpack.id, { onDelete: "cascade" }),
    clientFileId: integer("client_file_id").notNull(),
    serverPackFileId: integer("server_pack_file_id"),
    reportedAt: timestamp("reported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => [
    index("idx_modpack_publish_modpack").on(table.modpackId),
    uniqueIndex("idx_modpack_publish_unique").on(
      table.modpackId,
      table.clientFileId,
    ),
  ],
);

// --- modpack_release ---
// One row per published pack file we managed to read a manifest from, keyed by
// the client file's CurseForge id so re-reading the same release is a no-op
// (rows recorded before the server pack was read alongside carry its file id
// instead, and reconcile checks both). serverPackFileId records which server
// pack the membership was read with; a row frozen from the client file alone
// is re-frozen once a read carries the server pack, never the other way.
// Otherwise rows are append-only and self-contained: CurseForge drops
// archived files, so nothing here may depend on re-fetching them.

export const modpackRelease = pgTable(
  "modpack_release",
  {
    id: serial("id").primaryKey(),
    modpackId: integer("modpack_id")
      .notNull()
      .references(() => modpack.id, { onDelete: "cascade" }),
    curseforgeFileId: integer("curseforge_file_id").notNull(),
    serverPackFileId: integer("server_pack_file_id"),
    version: text("version"),
    displayName: text("display_name"),
    minecraftVersion: text("minecraft_version"),
    modLoader: text("mod_loader"),
    modCount: integer("mod_count").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_modpack_release_modpack").on(table.modpackId),
    uniqueIndex("idx_modpack_release_unique").on(
      table.modpackId,
      table.curseforgeFileId,
    ),
  ],
);

// --- modpack_release_mod ---
// Frozen membership of one release. fileName carries the mod version, so a diff
// between two releases never needs CurseForge. A manifest may list the same
// project twice with different files, hence the file id in the unique key.

export const modpackReleaseMod = pgTable(
  "modpack_release_mod",
  {
    id: serial("id").primaryKey(),
    releaseId: integer("release_id")
      .notNull()
      .references(() => modpackRelease.id, { onDelete: "cascade" }),
    curseforgeProjectId: integer("curseforge_project_id")
      .notNull()
      .references(() => curseforgeProject.id),
    fileId: integer("file_id").notNull(),
    fileName: text("file_name"),
    displayName: text("display_name"),
    fileReleaseType: integer("file_release_type"),
    fileDate: timestamp("file_date", { withTimezone: true }),
    required: boolean("required").notNull().default(true),
  },
  (table) => [
    index("idx_modpack_release_mod_release").on(table.releaseId),
    index("idx_modpack_release_mod_project").on(table.curseforgeProjectId),
    uniqueIndex("idx_modpack_release_mod_unique").on(
      table.releaseId,
      table.curseforgeProjectId,
      table.fileId,
    ),
  ],
);
