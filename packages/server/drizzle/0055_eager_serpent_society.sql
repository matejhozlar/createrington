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
CREATE UNIQUE INDEX "idx_modpack_publish_unique" ON "modpack_publish" USING btree ("modpack_id","client_file_id");--> statement-breakpoint
-- Packs that already had a server-only member confirmed by a server pack read
-- ship a server pack; flag them so the next client-only read is refused
-- instead of dropping those members again. Compared as text: the enum value
-- may have been added in this same transaction (see 0054)
UPDATE "modpack" m SET "ships_server_pack" = true
WHERE EXISTS (
  SELECT 1 FROM "modpack_mod" mm
  JOIN "curseforge_project" p ON p."id" = mm."curseforge_project_id"
  WHERE mm."modpack_id" = m."id"
    AND p."environment"::text = 'server'
    AND p."environment_source"::text = 'manifest'
);
