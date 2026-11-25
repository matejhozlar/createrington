ALTER TABLE "player_inactivity_warning" DROP CONSTRAINT "player_inactivity_warning_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "player_inactivity_warning" ALTER COLUMN "player_minecraft_uuid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "player_inactivity_warning" ADD COLUMN "minecraft_username" text;--> statement-breakpoint
ALTER TABLE "player_inactivity_warning" ADD COLUMN "discord_id" text;--> statement-breakpoint
ALTER TABLE "player_inactivity_warning" ADD CONSTRAINT "player_inactivity_warning_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE set null ON UPDATE cascade;