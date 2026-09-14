CREATE TABLE "player_inactivity_exemption" (
	"player_minecraft_uuid" uuid PRIMARY KEY NOT NULL,
	"reason" text,
	"created_by_discord_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_inactivity_exemption" ADD CONSTRAINT "player_inactivity_exemption_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_inactivity_exemption" ADD CONSTRAINT "player_inactivity_exemption_created_by_discord_id_player_discord_id_fk" FOREIGN KEY ("created_by_discord_id") REFERENCES "public"."player"("discord_id") ON DELETE set null ON UPDATE cascade;