import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

// --- feature_flag ---
// Runtime-toggleable feature switches controlled from the admin panel.

export const featureFlag = pgTable("feature_flag", {
  name: text("name").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
