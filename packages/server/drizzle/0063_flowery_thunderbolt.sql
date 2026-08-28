CREATE TABLE "playtime_archive" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"total_seconds" bigint DEFAULT 0 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"player_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
