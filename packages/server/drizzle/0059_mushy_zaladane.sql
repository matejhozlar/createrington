CREATE TABLE "server_maintenance_allowed_player" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"player_uuid" uuid NOT NULL,
	"added_by_discord_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_maintenance_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"motd" text,
	"message" text,
	"updated_by_discord_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ALTER COLUMN "estimated_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ADD COLUMN "until_restart" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "server_maintenance_allowed_player" ADD CONSTRAINT "server_maintenance_allowed_player_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_maintenance_setting" ADD CONSTRAINT "server_maintenance_setting_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_maintenance_allowed_player_unique" ON "server_maintenance_allowed_player" USING btree ("server_id","player_uuid");--> statement-breakpoint
CREATE INDEX "idx_server_maintenance_allowed_player_server" ON "server_maintenance_allowed_player" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_maintenance_setting_server" ON "server_maintenance_setting" USING btree ("server_id");