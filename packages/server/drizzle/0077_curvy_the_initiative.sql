CREATE TABLE "discord_top_role_reign" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_key" text NOT NULL,
	"discord_id" text NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"start_value" numeric(20, 3) NOT NULL,
	"last_value" numeric(20, 3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_discord_top_role_reign_open" ON "discord_top_role_reign" USING btree ("role_key") WHERE ended_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_discord_top_role_reign_role_started" ON "discord_top_role_reign" USING btree ("role_key","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_discord_top_role_reign_player" ON "discord_top_role_reign" USING btree ("minecraft_uuid");--> statement-breakpoint
INSERT INTO "discord_top_role_reign" ("role_key", "discord_id", "minecraft_uuid", "started_at", "start_value", "last_value")
SELECT "role_key", "discord_id", "minecraft_uuid", "held_since", "value", "value" FROM "discord_top_role";
