CREATE TABLE "player_inactivity_warning" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"warned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"warning_message_id" text,
	"resolved_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_inactivity_warning" ADD CONSTRAINT "player_inactivity_warning_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_player_inactivity_warning_uuid" ON "player_inactivity_warning" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_player_inactivity_warning_active" ON "player_inactivity_warning" USING btree ("warned_at") WHERE resolved_at IS NULL AND removed_at IS NULL;