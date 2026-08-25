CREATE TABLE "modpack_release_announcement" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"part" integer NOT NULL,
	"part_count" integer NOT NULL,
	"preset_id" integer,
	"channel_id" text NOT NULL,
	"message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "modpack_release_announcement" ADD CONSTRAINT "modpack_release_announcement_release_id_modpack_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."modpack_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_release_announcement" ADD CONSTRAINT "modpack_release_announcement_preset_id_discord_embed_preset_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."discord_embed_preset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_modpack_release_announcement_release" ON "modpack_release_announcement" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_modpack_release_announcement_unique" ON "modpack_release_announcement" USING btree ("release_id","part");