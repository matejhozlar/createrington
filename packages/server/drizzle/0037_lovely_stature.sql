DELETE FROM "vote_mod" WHERE "status" = 'rejected';--> statement-breakpoint
DROP INDEX "idx_vote_mod_claim_unique";--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."vote_mod_status";--> statement-breakpoint
CREATE TYPE "public"."vote_mod_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."vote_mod_status";--> statement-breakpoint
ALTER TABLE "vote_mod" ALTER COLUMN "status" SET DATA TYPE "public"."vote_mod_status" USING "status"::"public"."vote_mod_status";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_mod_claim_unique" ON "vote_mod" USING btree ("vote_id","curseforge_project_id") WHERE "vote_mod"."status" IN ('pending', 'approved');
