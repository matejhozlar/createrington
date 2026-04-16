CREATE TYPE "public"."player_prompt_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "player_prompt" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"created_by" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"role_ping_id" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "player_prompt_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_prompt_response" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt_id" integer NOT NULL,
	"discord_id" text NOT NULL,
	"minecraft_uuid" uuid,
	"response_text" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_prompt_response" ADD CONSTRAINT "player_prompt_response_prompt_id_player_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."player_prompt"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_prompt_response" ADD CONSTRAINT "player_prompt_response_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_player_prompt_status" ON "player_prompt" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_player_prompt_ends_at" ON "player_prompt" USING btree ("ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_player_prompt_response_prompt_discord" ON "player_prompt_response" USING btree ("prompt_id","discord_id");--> statement-breakpoint
CREATE INDEX "idx_player_prompt_response_prompt_id" ON "player_prompt_response" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "idx_player_prompt_response_minecraft_uuid" ON "player_prompt_response" USING btree ("minecraft_uuid");