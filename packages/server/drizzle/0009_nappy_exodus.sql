CREATE TYPE "public"."discord_auto_message_rotation" AS ENUM('sequential', 'random');--> statement-breakpoint
CREATE TABLE "discord_auto_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_id" integer NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_auto_message_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"interval_minutes" integer DEFAULT 60 NOT NULL,
	"rotation_mode" "discord_auto_message_rotation" DEFAULT 'sequential' NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_auto_message" ADD CONSTRAINT "discord_auto_message_config_id_discord_auto_message_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."discord_auto_message_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discord_auto_message_config_id" ON "discord_auto_message" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_discord_auto_message_sort" ON "discord_auto_message" USING btree ("config_id","sort_order");