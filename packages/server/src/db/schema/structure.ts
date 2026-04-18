import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";

// --- structure_pack ---
// Admin-defined collection of CurseForge mods that can be rotated in/out of the server.

export const structurePack = pgTable(
  "structure_pack",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    isActive: boolean("is_active").notNull().default(false),
    lastActivatedAt: timestamp("last_activated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_structure_pack_enabled").on(table.enabled),
    index("idx_structure_pack_active").on(table.isActive),
  ],
);

// --- structure_pack_mod ---
// Individual CurseForge mod files that belong to a structure pack.

export const structurePackMod = pgTable(
  "structure_pack_mod",
  {
    id: serial("id").primaryKey(),
    packId: integer("pack_id")
      .notNull()
      .references(() => structurePack.id, { onDelete: "cascade" }),
    curseforgeModId: integer("curseforge_mod_id").notNull(),
    curseforgeFileId: integer("curseforge_file_id").notNull(),
    fileName: text("file_name").notNull(),
    modName: text("mod_name").notNull(),
    modUrl: text("mod_url"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_structure_pack_mod_pack").on(table.packId),
    uniqueIndex("idx_structure_pack_mod_unique").on(
      table.packId,
      table.curseforgeModId,
    ),
  ],
);

// --- structure_pack_rotation ---
// Logs each rotation event with weight snapshot for auditability.

export const structurePackRotation = pgTable(
  "structure_pack_rotation",
  {
    id: serial("id").primaryKey(),
    outgoingPackId: integer("outgoing_pack_id").references(
      () => structurePack.id,
      { onDelete: "set null" },
    ),
    incomingPackId: integer("incoming_pack_id")
      .notNull()
      .references(() => structurePack.id, { onDelete: "restrict" }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    success: boolean("success").notNull(),
    failureReason: text("failure_reason"),
    weightsSnapshot: jsonb("weights_snapshot"),
  },
  (table) => [index("idx_structure_pack_rotation_rotated").on(table.rotatedAt)],
);

// --- structure_pack_rotation_config ---
// Singleton row holding the rotation schedule, boost pricing, and weight tuning.

export const structurePackRotationConfig = pgTable(
  "structure_pack_rotation_config",
  {
    id: serial("id").primaryKey(),
    period: text("period").notNull().default("weekly"),
    dayOfWeek: integer("day_of_week").notNull().default(1),
    dayOfMonth: integer("day_of_month").notNull().default(1),
    time: text("time").notNull().default("12:00"),
    timezone: text("timezone").notNull().default("UTC"),
    boostUnitPrice: integer("boost_unit_price").notNull().default(50),
    timeWeightMultiplier: real("time_weight_multiplier").notNull().default(1.0),
    boostWeightPerUnit: real("boost_weight_per_unit").notNull().default(1.0),
    gracePeriodMinutes: integer("grace_period_minutes").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// --- structure_pack_boost ---
// Player-purchased weight increases for a pack in the current rotation cycle.

export const structurePackBoost = pgTable(
  "structure_pack_boost",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    packId: integer("pack_id")
      .notNull()
      .references(() => structurePack.id, { onDelete: "cascade" }),
    units: integer("units").notNull(),
    currencySpent: integer("currency_spent").notNull(),
    cycleStart: timestamp("cycle_start", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_structure_pack_boost_cycle").on(table.cycleStart),
    index("idx_structure_pack_boost_player").on(table.discordId),
    index("idx_structure_pack_boost_pack").on(table.packId),
  ],
);
