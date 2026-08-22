ALTER TABLE "modpack_mod" ADD COLUMN "required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modpack_release_mod" ADD COLUMN "required" boolean DEFAULT true NOT NULL;