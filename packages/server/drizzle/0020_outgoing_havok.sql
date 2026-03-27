ALTER TABLE "structure_pack_rotation_config" ADD COLUMN "period" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "structure_pack_rotation_config" ADD COLUMN "day_of_month" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "structure_pack_rotation_config" ADD COLUMN "time_weight_multiplier" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "structure_pack_rotation_config" ADD COLUMN "boost_weight_per_unit" real DEFAULT 1 NOT NULL;