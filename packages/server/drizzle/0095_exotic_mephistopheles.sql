CREATE TABLE "player_vote" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid,
	"username" text NOT NULL,
	"service_name" text NOT NULL,
	"address" text,
	"voted_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rewarded_at" timestamp with time zone,
	"reward_error" text
);
--> statement-breakpoint
ALTER TABLE "player_vote" ADD CONSTRAINT "player_vote_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "player_vote_service_username_voted_at" ON "player_vote" USING btree ("service_name",lower("username"),"voted_at");--> statement-breakpoint
CREATE INDEX "idx_player_vote_player_voted_at" ON "player_vote" USING btree ("player_minecraft_uuid","voted_at");--> statement-breakpoint
CREATE INDEX "idx_player_vote_username_lower" ON "player_vote" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "idx_player_vote_pending" ON "player_vote" USING btree ("player_minecraft_uuid") WHERE rewarded_at IS NULL;