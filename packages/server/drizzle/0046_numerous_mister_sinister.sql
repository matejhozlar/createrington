CREATE TYPE "public"."mod_environment" AS ENUM('client', 'server', 'both', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."mod_environment_source" AS ENUM('cf_flag', 'manual');--> statement-breakpoint
ALTER TABLE "curseforge_project" ADD COLUMN "environment" "mod_environment" DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE "curseforge_project" ADD COLUMN "environment_source" "mod_environment_source";