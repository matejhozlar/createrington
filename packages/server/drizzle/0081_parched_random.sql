CREATE TABLE "auth_launcher_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_launcher_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "auth_launcher_session" ADD CONSTRAINT "auth_launcher_session_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_auth_launcher_session_player_uuid" ON "auth_launcher_session" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_auth_launcher_session_expires_at" ON "auth_launcher_session" USING btree ("expires_at") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_auth_launcher_session_family_id" ON "auth_launcher_session" USING btree ("family_id");