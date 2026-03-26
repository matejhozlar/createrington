CREATE TABLE "structure_pack" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_activated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "structure_pack_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "structure_pack_boost" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"pack_id" integer NOT NULL,
	"units" integer NOT NULL,
	"currency_spent" integer NOT NULL,
	"cycle_start" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structure_pack_mod" (
	"id" serial PRIMARY KEY NOT NULL,
	"pack_id" integer NOT NULL,
	"curseforge_mod_id" integer NOT NULL,
	"curseforge_file_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"mod_name" text NOT NULL,
	"mod_url" text,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structure_pack_rotation" (
	"id" serial PRIMARY KEY NOT NULL,
	"outgoing_pack_id" integer,
	"incoming_pack_id" integer NOT NULL,
	"rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"failure_reason" text,
	"weights_snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "structure_pack_rotation_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_of_week" integer DEFAULT 1 NOT NULL,
	"time" text DEFAULT '12:00' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"boost_unit_price" integer DEFAULT 50 NOT NULL,
	"grace_period_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "structure_pack_boost" ADD CONSTRAINT "structure_pack_boost_pack_id_structure_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."structure_pack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structure_pack_mod" ADD CONSTRAINT "structure_pack_mod_pack_id_structure_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."structure_pack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structure_pack_rotation" ADD CONSTRAINT "structure_pack_rotation_outgoing_pack_id_structure_pack_id_fk" FOREIGN KEY ("outgoing_pack_id") REFERENCES "public"."structure_pack"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structure_pack_rotation" ADD CONSTRAINT "structure_pack_rotation_incoming_pack_id_structure_pack_id_fk" FOREIGN KEY ("incoming_pack_id") REFERENCES "public"."structure_pack"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_structure_pack_enabled" ON "structure_pack" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_structure_pack_active" ON "structure_pack" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_structure_pack_boost_cycle" ON "structure_pack_boost" USING btree ("cycle_start");--> statement-breakpoint
CREATE INDEX "idx_structure_pack_boost_player" ON "structure_pack_boost" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "idx_structure_pack_boost_pack" ON "structure_pack_boost" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "idx_structure_pack_mod_pack" ON "structure_pack_mod" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_structure_pack_mod_unique" ON "structure_pack_mod" USING btree ("pack_id","curseforge_mod_id");--> statement-breakpoint
CREATE INDEX "idx_structure_pack_rotation_rotated" ON "structure_pack_rotation" USING btree ("rotated_at");