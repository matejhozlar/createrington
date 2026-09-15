import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  inet,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const fixtureStatusEnum = pgEnum("fixture_status", [
  "active",
  "archived",
]);

export const fixtureKindEnum = pgEnum("fixture_kind", [
  "alpha",
  "beta",
  "gamma",
]);

export const fixtureSourceEnum = pgEnum("fixture_source", ["import", "manual"]);

export const fixtureParent = pgTable("fixture_parent", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  email: text("email").unique(),
  status: fixtureStatusEnum("status").notNull().default("active"),
  kind: fixtureKindEnum("kind"),
  displayName: text("display_name"),
  score: integer("score").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fixtureParentChild = pgTable(
  "fixture_parent_child",
  {
    parentId: integer("parent_id")
      .notNull()
      .references(() => fixtureParent.id, { onDelete: "cascade" }),
    childKey: text("child_key").notNull(),
    source: fixtureSourceEnum("source").notNull(),
    externalId: text("external_id").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    quantity: numeric("quantity", { precision: 8, scale: 0 })
      .notNull()
      .default("0"),
    ledger: numeric("ledger", { precision: 20, scale: 0 }),
    ratio: numeric("ratio"),
    bigAmount: bigint("big_amount", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.parentId, table.childKey] }),
    uniqueIndex("idx_fixture_parent_child_external").on(
      table.source,
      table.externalId,
    ),
    uniqueIndex("idx_fixture_parent_child_note_live")
      .on(table.parentId, table.note)
      .where(sql`note IS NOT NULL`),
  ],
);

export const fixtureParentChildLeaf = pgTable(
  "fixture_parent_child_leaf",
  {
    parentId: integer("parent_id").notNull(),
    childKey: text("child_key").notNull(),
    leafNo: integer("leaf_no").notNull(),
    token: uuid("token")
      .notNull()
      .default(sql`gen_random_uuid()`),
    label: text("label"),
    recordedOn: date("recorded_on").notNull(),
    recordedAt: timestamp("recorded_at"),
    sourceIp: inet("source_ip"),
    totalSeconds: bigint("total_seconds", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    sessions: integer("sessions").notNull().default(0),
    avgSeconds: bigint("avg_seconds", { mode: "bigint" }).generatedAlwaysAs(
      sql`CASE WHEN sessions > 0 THEN total_seconds / sessions ELSE 0 END`,
    ),
    weight: integer("weight")
      .notNull()
      .generatedAlwaysAs(sql`sessions * 10`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.parentId, table.childKey, table.leafNo] }),
    uniqueIndex("idx_fixture_parent_child_leaf_token").on(table.token),
    uniqueIndex("idx_fixture_parent_child_leaf_label_live")
      .on(table.label)
      .where(sql`archived_at IS NULL`),
  ],
);

export const fixtureAuditEntry = pgTable(
  "fixture_audit_entry",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    reference: text("reference"),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_fixture_audit_entry_actor_action").on(
      table.actorId,
      table.action,
    ),
    unique("uq_fixture_audit_entry_reference").on(table.reference),
  ],
);

export const fixtureSetting = pgTable("fixture_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  code: varchar("code", { length: 16 }),
  rank: smallint("rank").notNull().default(0),
  weight: real("weight"),
  factor: doublePrecision("factor"),
  payload: json("payload"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
