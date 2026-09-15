ALTER TABLE "player_session" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_session" ADD COLUMN "start_play_ticks" integer;--> statement-breakpoint
ALTER TABLE "player_session" ADD COLUMN "last_play_ticks" integer;--> statement-breakpoint
ALTER TABLE "player_session" ADD COLUMN "active_seconds" bigint DEFAULT 0 NOT NULL;