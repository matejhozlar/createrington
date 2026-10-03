CREATE TYPE "public"."curseforge_file_source" AS ENUM('curseforge', 'modrinth', 'storage', 'manual');--> statement-breakpoint
CREATE TABLE "curseforge_file" (
	"id" integer PRIMARY KEY NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"sha1" text NOT NULL,
	"source" "curseforge_file_source" NOT NULL,
	"download_url" text,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "pack_file_name" text;--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "pack_file_size" integer;--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "pack_sha1" text;--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "pack_download_url" text;--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "java_major_version" integer;--> statement-breakpoint
ALTER TABLE "modpack_release" ADD COLUMN "launcher_ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "curseforge_file" ADD CONSTRAINT "curseforge_file_curseforge_project_id_curseforge_project_id_fk" FOREIGN KEY ("curseforge_project_id") REFERENCES "public"."curseforge_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_curseforge_file_project" ON "curseforge_file" USING btree ("curseforge_project_id");