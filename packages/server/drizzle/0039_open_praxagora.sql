CREATE TYPE "public"."vote_mod_reject_reason" AS ENUM('on_hold', 'incompatible', 'covered_by_other_mod', 'not_a_good_fit');--> statement-breakpoint
ALTER TABLE "vote_mod_ban" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "vote_mod_ban" CASCADE;--> statement-breakpoint
DELETE FROM "vote_mod" WHERE "status" = 'declined';--> statement-breakpoint
DROP INDEX "idx_vote_mod_claim_unique";--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."vote_mod_status";--> statement-breakpoint
CREATE TYPE "public"."vote_mod_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."vote_mod_status";--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DATA TYPE "public"."vote_mod_status" USING "status"::"public"."vote_mod_status";--> statement-breakpoint
ALTER TABLE "vote_mod" ADD COLUMN "reject_reason" "vote_mod_reject_reason";--> statement-breakpoint
ALTER TABLE "vote_mod" ADD COLUMN "reject_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_mod_claim_unique" ON "vote_mod" USING btree ("vote_id","curseforge_project_id");
