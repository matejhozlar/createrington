CREATE TABLE "discord_embed_preset_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"preset_id" integer NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_embed_preset_message" ADD CONSTRAINT "discord_embed_preset_message_preset_id_discord_embed_preset_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."discord_embed_preset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discord_embed_preset_message_preset" ON "discord_embed_preset_message" USING btree ("preset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_discord_embed_preset_message_unique" ON "discord_embed_preset_message" USING btree ("channel_id","message_id");