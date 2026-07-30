CREATE TYPE "public"."workshop_mod_reject_reason" AS ENUM('on_hold', 'incompatible', 'covered_by_other_mod', 'not_a_good_fit');--> statement-breakpoint
CREATE TYPE "public"."workshop_mod_source" AS ENUM('user', 'admin', 'dependency');--> statement-breakpoint
CREATE TYPE "public"."workshop_mod_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."workshop_poll_granularity" AS ENUM('per_mod', 'bundle');--> statement-breakpoint
CREATE TYPE "public"."workshop_poll_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."workshop_status" AS ENUM('draft', 'open', 'closed', 'archived');--> statement-breakpoint
CREATE TABLE "curseforge_project" (
	"id" integer PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"thumbnail_url" text,
	"website_url" text,
	"primary_author" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screenshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"date_modified" timestamp with time zone,
	"date_released" timestamp with time zone,
	"allow_mod_distribution" boolean,
	"is_available" boolean DEFAULT true NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag" (
	"name" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "workshop_status" DEFAULT 'draft' NOT NULL,
	"game_version" text NOT NULL,
	"mod_loader_type" integer NOT NULL,
	"class_id" integer DEFAULT 6 NOT NULL,
	"base_modpack_project_id" integer,
	"max_mods_per_user" integer DEFAULT 5 NOT NULL,
	"max_upvotes_per_user" integer DEFAULT 5 NOT NULL,
	"discord_forum_channel_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workshop_mod" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_id" integer NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"source" "workshop_mod_source" DEFAULT 'user' NOT NULL,
	"submitted_by" text NOT NULL,
	"status" "workshop_mod_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"reject_reason" "workshop_mod_reject_reason",
	"reject_note" text,
	"file_id" integer,
	"file_name" text,
	"file_release_type" integer,
	"discord_thread_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_mod_dependency" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_mod_id" integer NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"relation_type" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_mod_upvote" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_mod_id" integer NOT NULL,
	"discord_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_poll" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_id" integer NOT NULL,
	"title" text,
	"granularity" "workshop_poll_granularity" NOT NULL,
	"status" "workshop_poll_status" DEFAULT 'open' NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"discord_channel_id" text,
	"discord_message_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_poll_ballot" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"poll_mod_id" integer,
	"discord_id" text NOT NULL,
	"choice" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_poll_mod" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"workshop_mod_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workshop_mod" ADD CONSTRAINT "workshop_mod_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_mod" ADD CONSTRAINT "workshop_mod_curseforge_project_id_curseforge_project_id_fk" FOREIGN KEY ("curseforge_project_id") REFERENCES "public"."curseforge_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_mod_dependency" ADD CONSTRAINT "workshop_mod_dependency_workshop_mod_id_workshop_mod_id_fk" FOREIGN KEY ("workshop_mod_id") REFERENCES "public"."workshop_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_mod_dependency" ADD CONSTRAINT "workshop_mod_dependency_curseforge_project_id_curseforge_project_id_fk" FOREIGN KEY ("curseforge_project_id") REFERENCES "public"."curseforge_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_mod_upvote" ADD CONSTRAINT "workshop_mod_upvote_workshop_mod_id_workshop_mod_id_fk" FOREIGN KEY ("workshop_mod_id") REFERENCES "public"."workshop_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_poll" ADD CONSTRAINT "workshop_poll_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_poll_ballot" ADD CONSTRAINT "workshop_poll_ballot_poll_id_workshop_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."workshop_poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_poll_ballot" ADD CONSTRAINT "workshop_poll_ballot_poll_mod_id_workshop_poll_mod_id_fk" FOREIGN KEY ("poll_mod_id") REFERENCES "public"."workshop_poll_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_poll_mod" ADD CONSTRAINT "workshop_poll_mod_poll_id_workshop_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."workshop_poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_poll_mod" ADD CONSTRAINT "workshop_poll_mod_workshop_mod_id_workshop_mod_id_fk" FOREIGN KEY ("workshop_mod_id") REFERENCES "public"."workshop_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_curseforge_project_slug" ON "curseforge_project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_curseforge_project_class" ON "curseforge_project" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_status" ON "workshop" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_workshop" ON "workshop_mod" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_status" ON "workshop_mod" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_submitter" ON "workshop_mod" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_project" ON "workshop_mod" USING btree ("curseforge_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workshop_mod_claim_unique" ON "workshop_mod" USING btree ("workshop_id","curseforge_project_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_dependency_mod" ON "workshop_mod_dependency" USING btree ("workshop_mod_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workshop_mod_dependency_unique" ON "workshop_mod_dependency" USING btree ("workshop_mod_id","curseforge_project_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_upvote_player" ON "workshop_mod_upvote" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workshop_mod_upvote_unique" ON "workshop_mod_upvote" USING btree ("workshop_mod_id","discord_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_workshop" ON "workshop_poll" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_status" ON "workshop_poll" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_ends" ON "workshop_poll" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_ballot_poll" ON "workshop_poll_ballot" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_poll_ballot_player" ON "workshop_poll_ballot" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workshop_poll_ballot_mod_unique" ON "workshop_poll_ballot" USING btree ("poll_id","poll_mod_id","discord_id") WHERE "workshop_poll_ballot"."poll_mod_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workshop_poll_ballot_bundle_unique" ON "workshop_poll_ballot" USING btree ("poll_id","discord_id") WHERE "workshop_poll_ballot"."poll_mod_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workshop_poll_mod_unique" ON "workshop_poll_mod" USING btree ("poll_id","workshop_mod_id");