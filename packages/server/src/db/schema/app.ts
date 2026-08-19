import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// --- app_setting ---
// Generic runtime settings controlled from the admin panel, one row per key.
// Values are wrapped in a { value } envelope and validated per key by the
// settings service.

export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: text("updated_by"),
});
