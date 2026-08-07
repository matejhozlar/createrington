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

// --- modpack ---
// The durable pack artifact a workshop feeds into. curseforgeProjectId points
// at the published CurseForge pack and stays null until its first publish;
// live state of members is derived from that project's manifest.

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
// A mod in (or slated for) a modpack. Suggestions feed this table on approval;
// admin adds, promoted dependencies, and manifest imports land here directly.
// liveAt set = shipped in the published pack, droppedFromManifestAt set = was
// live but missing from the latest published version (admin attention).
// workshopModId links the winning suggestion; kept by service code, no FK, so
// a future workshop-delete endpoint must clear these links itself.

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
    workshopModId: integer("workshop_mod_id"),
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
    uniqueIndex("idx_modpack_mod_unique").on(
      table.modpackId,
      table.curseforgeProjectId,
    ),
  ],
);
