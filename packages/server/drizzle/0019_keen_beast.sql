ALTER TABLE "structure_pack_rotation" DROP CONSTRAINT "structure_pack_rotation_incoming_pack_id_structure_pack_id_fk";
--> statement-breakpoint
ALTER TABLE "structure_pack_rotation" ADD CONSTRAINT "structure_pack_rotation_incoming_pack_id_structure_pack_id_fk" FOREIGN KEY ("incoming_pack_id") REFERENCES "public"."structure_pack"("id") ON DELETE restrict ON UPDATE no action;