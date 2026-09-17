ALTER TABLE "player_prompt_response" DROP CONSTRAINT "player_prompt_response_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "player_prompt_response" ADD CONSTRAINT "player_prompt_response_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;