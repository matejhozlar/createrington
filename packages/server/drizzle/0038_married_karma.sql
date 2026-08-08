-- Recreate the enum instead of ADD VALUE: drizzle applies pending migrations
-- in one transaction, and values added via ADD VALUE cannot be used (by the
-- 0039 backfill) before that transaction commits.
ALTER TYPE "public"."workshop_mod_status" RENAME TO "workshop_mod_status_old";--> statement-breakpoint
CREATE TYPE "public"."workshop_mod_status" AS ENUM ('pending', 'approved', 'testing', 'next_update', 'in_pack', 'rejected');--> statement-breakpoint
ALTER TABLE "workshop_mod" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workshop_mod" ALTER COLUMN "status" TYPE "public"."workshop_mod_status" USING "status"::text::"public"."workshop_mod_status";--> statement-breakpoint
ALTER TABLE "workshop_mod" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "public"."workshop_mod_status_old";
