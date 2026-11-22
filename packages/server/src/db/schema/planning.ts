import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { planningCategoryEnum, planningItemStatusEnum } from "./enums";
import { admin } from "./admin";

// --- planning_subcategory ---
// Team-editable second level under the fixed planning categories.

export const planningSubcategory = pgTable(
  "planning_subcategory",
  {
    id: serial("id").primaryKey(),
    category: planningCategoryEnum("category").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_planning_subcategory_category_name").on(
      table.category,
      table.name,
    ),
  ],
);

// --- planning_item ---
// Current state of one planning item; body is markdown. Every save also writes a
// planning_item_revision row with the same content; revision is the number
// of the latest one and guards against two admins overwriting each other.

export const planningItem = pgTable(
  "planning_item",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body"),
    category: planningCategoryEnum("category").notNull(),
    subcategoryId: integer("subcategory_id").references(
      () => planningSubcategory.id,
      { onDelete: "set null" },
    ),
    status: planningItemStatusEnum("status").notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    // Discord message the item was captured from by /idea; null when it was
    // written on the website
    sourceUrl: text("source_url"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_planning_item_status").on(table.status),
    index("idx_planning_item_category").on(table.category),
  ],
);

// --- planning_item_revision ---
// Append-only full copy of a planning item per save, the first included.
// Restoring an old revision writes a new one. subcategoryId is a plain int
// (no FK) so history keeps the id after the subcategory is deleted.

export const planningItemRevision = pgTable(
  "planning_item_revision",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => planningItem.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    category: planningCategoryEnum("category").notNull(),
    subcategoryId: integer("subcategory_id"),
    status: planningItemStatusEnum("status").notNull(),
    editedBy: text("edited_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_planning_item_revision_unique").on(
      table.itemId,
      table.revision,
    ),
  ],
);

// --- planning_item_comment ---

export const planningItemComment = pgTable(
  "planning_item_comment",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => planningItem.id, { onDelete: "cascade" }),
    authorDiscordId: text("author_discord_id").notNull(),
    body: text("body").notNull(),
    // Set when the comment is a summary of a Discord discussion; the author
    // is then the admin who ran /idea
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_planning_item_comment_item").on(table.itemId, table.createdAt),
  ],
);

// --- planning_item_assignee ---
// Admins responsible for an item. Rows follow the admin table, so a demoted
// admin drops off every item.

export const planningItemAssignee = pgTable(
  "planning_item_assignee",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => planningItem.id, { onDelete: "cascade" }),
    discordId: text("discord_id")
      .notNull()
      .references(() => admin.discordId, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    assignedBy: text("assigned_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_planning_item_assignee_admin").on(table.discordId),
    uniqueIndex("idx_planning_item_assignee_unique").on(
      table.itemId,
      table.discordId,
    ),
  ],
);
