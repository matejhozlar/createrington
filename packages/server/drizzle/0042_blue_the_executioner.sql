CREATE TABLE "modpack_release" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_id" integer NOT NULL,
	"curseforge_file_id" integer NOT NULL,
	"version" text,
	"display_name" text,
	"minecraft_version" text,
	"mod_loader" text,
	"mod_count" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_release_mod" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"file_name" text,
	"display_name" text,
	"file_release_type" integer,
	"file_date" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "modpack_release" ADD CONSTRAINT "modpack_release_modpack_id_modpack_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_release_mod" ADD CONSTRAINT "modpack_release_mod_release_id_modpack_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."modpack_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_release_mod" ADD CONSTRAINT "modpack_release_mod_curseforge_project_id_curseforge_project_id_fk" FOREIGN KEY ("curseforge_project_id") REFERENCES "public"."curseforge_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_modpack_release_modpack" ON "modpack_release" USING btree ("modpack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_modpack_release_unique" ON "modpack_release" USING btree ("modpack_id","curseforge_file_id");--> statement-breakpoint
CREATE INDEX "idx_modpack_release_mod_release" ON "modpack_release_mod" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "idx_modpack_release_mod_project" ON "modpack_release_mod" USING btree ("curseforge_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_modpack_release_mod_unique" ON "modpack_release_mod" USING btree ("release_id","curseforge_project_id","file_id");