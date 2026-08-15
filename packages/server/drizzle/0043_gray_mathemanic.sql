CREATE TYPE "public"."workshop_mod_event_type" AS ENUM('suggested', 'withdrawn', 'approved', 'rejected', 'testing_started', 'sent_back', 'shipped', 'dropped');--> statement-breakpoint
CREATE TABLE "workshop_mod_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_id" integer NOT NULL,
	"workshop_mod_id" integer NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"event_type" "workshop_mod_event_type" NOT NULL,
	"actor_discord_id" text,
	"from_status" "workshop_mod_status",
	"to_status" "workshop_mod_status",
	"reject_reason" "workshop_mod_reject_reason",
	"note" text,
	"release_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workshop_mod_event" ADD CONSTRAINT "workshop_mod_event_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_event_mod" ON "workshop_mod_event" USING btree ("workshop_mod_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_event_workshop" ON "workshop_mod_event" USING btree ("workshop_id");