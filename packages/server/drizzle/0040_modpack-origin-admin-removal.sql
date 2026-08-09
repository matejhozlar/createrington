-- Admin adds go through the suggestion funnel now, so nothing writes a pack row
-- directly any more and the origin value goes away. The workshop feature has
-- never been enabled outside development, so these rows only exist locally and
-- on the dev deployment: they are dropped rather than converted, and reconcile
-- re-imports any that a published manifest still lists.
DELETE FROM "modpack_mod" WHERE "origin" = 'admin';--> statement-breakpoint
ALTER TABLE "modpack_mod" ALTER COLUMN "origin" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."modpack_mod_origin";--> statement-breakpoint
CREATE TYPE "public"."modpack_mod_origin" AS ENUM('suggestion', 'dependency', 'import');--> statement-breakpoint
ALTER TABLE "modpack_mod" ALTER COLUMN "origin" SET DATA TYPE "public"."modpack_mod_origin" USING "origin"::"public"."modpack_mod_origin";
