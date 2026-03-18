CREATE TABLE "discord_embed_preset_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_embed_preset_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "discord_embed_preset" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "discord_embed_preset" ADD CONSTRAINT "discord_embed_preset_category_id_discord_embed_preset_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."discord_embed_preset_category"("id") ON DELETE set null ON UPDATE no action;