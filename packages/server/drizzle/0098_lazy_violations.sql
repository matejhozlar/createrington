-- Planning has only run locally and on dev. Its items carry the old statuses
-- (inbox, discussing, decided, building, done, rejected), so they are deleted
-- rather than converted; revisions, comments and assignees go with them.
DELETE FROM "planning_item";--> statement-breakpoint
ALTER TABLE "planning_item" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "planning_item" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
ALTER TABLE "planning_item_revision" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."planning_item_status";--> statement-breakpoint
CREATE TYPE "public"."planning_item_status" AS ENUM('draft', 'open', 'approved');--> statement-breakpoint
ALTER TABLE "planning_item" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."planning_item_status";--> statement-breakpoint
ALTER TABLE "planning_item" ALTER COLUMN "status" SET DATA TYPE "public"."planning_item_status" USING "status"::"public"."planning_item_status";--> statement-breakpoint
ALTER TABLE "planning_item_revision" ALTER COLUMN "status" SET DATA TYPE "public"."planning_item_status" USING "status"::"public"."planning_item_status";--> statement-breakpoint
ALTER TABLE "planning_item" DROP COLUMN "decision";--> statement-breakpoint
ALTER TABLE "planning_item_revision" DROP COLUMN "decision";