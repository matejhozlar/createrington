DROP INDEX "idx_workshop_mod_workshop";--> statement-breakpoint
DROP INDEX "idx_workshop_mod_status";--> statement-breakpoint
DROP INDEX "idx_workshop_mod_submitter";--> statement-breakpoint
ALTER TABLE "modpack_mod" ADD CONSTRAINT "modpack_mod_workshop_mod_id_workshop_mod_id_fk" FOREIGN KEY ("workshop_mod_id") REFERENCES "public"."workshop_mod"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_modpack_mod_project" ON "modpack_mod" USING btree ("curseforge_project_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_workshop_status" ON "workshop_mod" USING btree ("workshop_id","status");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_ballot_mod" ON "workshop_poll_ballot" USING btree ("poll_mod_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_mod_mod" ON "workshop_poll_mod" USING btree ("workshop_mod_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_submitter" ON "workshop_mod" USING btree ("submitted_by","workshop_id");