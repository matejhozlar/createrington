CREATE TABLE "server_maintenance_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"scheduled_by_discord_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ADD CONSTRAINT "server_maintenance_schedule_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_server_maintenance_schedule_server_status" ON "server_maintenance_schedule" USING btree ("server_id","status");
