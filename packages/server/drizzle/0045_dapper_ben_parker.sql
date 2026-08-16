CREATE TYPE "public"."player_prompt_entry_mode" AS ENUM('single', 'multi');--> statement-breakpoint
DROP INDEX "uq_player_prompt_response_prompt_discord";--> statement-breakpoint
ALTER TABLE "player_prompt" ADD COLUMN "entry_mode" "player_prompt_entry_mode" DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_prompt" ADD COLUMN "max_entries" integer;--> statement-breakpoint
ALTER TABLE "player_prompt" ADD COLUMN "cooldown_seconds" integer;--> statement-breakpoint
ALTER TABLE "player_prompt_response" ADD COLUMN "entry_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_player_prompt_response_prompt_discord_entry" ON "player_prompt_response" USING btree ("prompt_id","discord_id","entry_number");