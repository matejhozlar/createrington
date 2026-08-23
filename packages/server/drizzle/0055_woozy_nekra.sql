CREATE TABLE "modpack_publish" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_id" integer NOT NULL,
	"client_file_id" integer NOT NULL,
	"server_pack_file_id" integer,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ingested_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "modpack" ADD COLUMN "ships_server_pack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "server_pack_file_id" integer;--> statement-breakpoint
ALTER TABLE "modpack_publish" ADD CONSTRAINT "modpack_publish_modpack_id_modpack_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_modpack_publish_modpack" ON "modpack_publish" USING btree ("modpack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_modpack_publish_unique" ON "modpack_publish" USING btree ("modpack_id","client_file_id");