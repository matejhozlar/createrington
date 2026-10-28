CREATE TYPE "public"."launcher_release_status" AS ENUM('pending', 'released', 'withdrawn');--> statement-breakpoint
CREATE TABLE "launcher_release" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"signature" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"pub_date" timestamp with time zone NOT NULL,
	"status" "launcher_release_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_discord_id" text,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by_discord_id" text,
	CONSTRAINT "uq_launcher_release_platform_version" UNIQUE("platform","version")
);
--> statement-breakpoint
CREATE INDEX "idx_launcher_release_platform_status" ON "launcher_release" USING btree ("platform","status");