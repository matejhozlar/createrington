ALTER TYPE "public"."launcher_release_status" ADD VALUE 'pruned';--> statement-breakpoint
ALTER TABLE "launcher_release" ADD COLUMN "pruned_at" timestamp with time zone;