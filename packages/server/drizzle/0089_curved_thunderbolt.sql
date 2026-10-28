CREATE TYPE "public"."launcher_pack_source" AS ENUM('curseforge', 'sandbox');--> statement-breakpoint
CREATE TABLE "launcher_pack" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"modpack_id" integer NOT NULL,
	"source" "launcher_pack_source" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_launcher_pack_slug" UNIQUE("slug"),
	CONSTRAINT "uq_launcher_pack_modpack" UNIQUE("modpack_id")
);
--> statement-breakpoint
ALTER TABLE "launcher_pack" ADD CONSTRAINT "launcher_pack_modpack_id_modpack_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpack"("id") ON DELETE restrict ON UPDATE no action;