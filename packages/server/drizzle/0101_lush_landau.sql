DELETE FROM "structure_pack_boost" WHERE "created_at" <= (SELECT MAX("rotated_at") FROM "structure_pack_rotation" WHERE "success");--> statement-breakpoint
DROP INDEX "idx_structure_pack_boost_cycle";--> statement-breakpoint
ALTER TABLE "structure_pack_boost" DROP COLUMN "cycle_start";
