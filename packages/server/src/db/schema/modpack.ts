import {
  pgTable,
  serial,
  integer,
  text,
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

export const modpack = pgTable(
  "modpack",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    curseforgeProjectId: integer("curseforge_project_id"),
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
