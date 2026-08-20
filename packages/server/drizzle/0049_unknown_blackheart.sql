CREATE TYPE "public"."waitlist_status" AS ENUM('queued', 'promoted', 'registered', 'expired');--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"status" "waitlist_status" DEFAULT 'queued' NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"promoted_at" timestamp with time zone,
	"promoted_by" text,
	"registered_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"joined_minecraft" boolean DEFAULT false NOT NULL,
	"verify_channel_id" text,
	"waiting_message_id" text,
	"admin_message_id" text,
	"metadata" jsonb,
	CONSTRAINT "waitlist_entry_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE INDEX "idx_waitlist_status" ON "waitlist_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_waitlist_queued_at" ON "waitlist_entry" USING btree ("queued_at");