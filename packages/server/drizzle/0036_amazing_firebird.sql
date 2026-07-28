CREATE TYPE "public"."vote_mod_source" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vote_mod_status" AS ENUM('pending', 'approved', 'declined', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vote_poll_granularity" AS ENUM('per_mod', 'bundle');--> statement-breakpoint
CREATE TYPE "public"."vote_poll_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."vote_status" AS ENUM('draft', 'open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vote_submission_status" AS ENUM('active', 'closed');--> statement-breakpoint
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
CREATE TABLE "vote" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "vote_status" DEFAULT 'draft' NOT NULL,
	"game_version" text NOT NULL,
	"mod_loader_type" integer NOT NULL,
	"class_id" integer DEFAULT 6 NOT NULL,
	"base_modpack_project_id" integer,
	"max_mods_per_submission" integer DEFAULT 5 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vote_mod" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_id" integer NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"submission_id" integer,
	"source" "vote_mod_source" DEFAULT 'user' NOT NULL,
	"submitted_by" text NOT NULL,
	"status" "vote_mod_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"file_id" integer,
	"file_name" text,
	"file_release_type" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_mod_ban" (
	"id" serial PRIMARY KEY NOT NULL,
	"curseforge_project_id" integer NOT NULL,
	"reason" text,
	"banned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_mod_ban_curseforge_project_id_unique" UNIQUE("curseforge_project_id")
);
--> statement-breakpoint
CREATE TABLE "vote_mod_upvote" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_mod_id" integer NOT NULL,
	"discord_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_poll" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_id" integer NOT NULL,
	"title" text,
	"granularity" "vote_poll_granularity" NOT NULL,
	"status" "vote_poll_status" DEFAULT 'open' NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"discord_channel_id" text,
	"discord_message_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_poll_ballot" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"poll_mod_id" integer,
	"discord_id" text NOT NULL,
	"choice" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_poll_mod" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"vote_mod_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_id" integer NOT NULL,
	"discord_id" text NOT NULL,
	"status" "vote_submission_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_submission_upvote" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"discord_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vote_mod" ADD CONSTRAINT "vote_mod_vote_id_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_mod" ADD CONSTRAINT "vote_mod_curseforge_project_id_curseforge_project_id_fk" FOREIGN KEY ("curseforge_project_id") REFERENCES "public"."curseforge_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_mod" ADD CONSTRAINT "vote_mod_submission_id_vote_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."vote_submission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_mod_ban" ADD CONSTRAINT "vote_mod_ban_curseforge_project_id_curseforge_project_id_fk" FOREIGN KEY ("curseforge_project_id") REFERENCES "public"."curseforge_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_mod_upvote" ADD CONSTRAINT "vote_mod_upvote_vote_mod_id_vote_mod_id_fk" FOREIGN KEY ("vote_mod_id") REFERENCES "public"."vote_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_poll" ADD CONSTRAINT "vote_poll_vote_id_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_poll_ballot" ADD CONSTRAINT "vote_poll_ballot_poll_id_vote_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."vote_poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_poll_ballot" ADD CONSTRAINT "vote_poll_ballot_poll_mod_id_vote_poll_mod_id_fk" FOREIGN KEY ("poll_mod_id") REFERENCES "public"."vote_poll_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_poll_mod" ADD CONSTRAINT "vote_poll_mod_poll_id_vote_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."vote_poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_poll_mod" ADD CONSTRAINT "vote_poll_mod_vote_mod_id_vote_mod_id_fk" FOREIGN KEY ("vote_mod_id") REFERENCES "public"."vote_mod"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_submission" ADD CONSTRAINT "vote_submission_vote_id_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_submission_upvote" ADD CONSTRAINT "vote_submission_upvote_submission_id_vote_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."vote_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_curseforge_project_slug" ON "curseforge_project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_curseforge_project_class" ON "curseforge_project" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_vote_status" ON "vote" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vote_mod_vote" ON "vote_mod" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "idx_vote_mod_submission" ON "vote_mod" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_vote_mod_status" ON "vote_mod" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vote_mod_submitter" ON "vote_mod" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_vote_mod_project" ON "vote_mod" USING btree ("curseforge_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_mod_claim_unique" ON "vote_mod" USING btree ("vote_id","curseforge_project_id") WHERE "vote_mod"."status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "idx_vote_mod_upvote_player" ON "vote_mod_upvote" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_mod_upvote_unique" ON "vote_mod_upvote" USING btree ("vote_mod_id","discord_id");--> statement-breakpoint
CREATE INDEX "idx_vote_poll_vote" ON "vote_poll" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "idx_vote_poll_status" ON "vote_poll" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vote_poll_ends" ON "vote_poll" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "idx_vote_poll_ballot_poll" ON "vote_poll_ballot" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_vote_poll_ballot_player" ON "vote_poll_ballot" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_poll_ballot_mod_unique" ON "vote_poll_ballot" USING btree ("poll_id","poll_mod_id","discord_id") WHERE "vote_poll_ballot"."poll_mod_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_poll_ballot_bundle_unique" ON "vote_poll_ballot" USING btree ("poll_id","discord_id") WHERE "vote_poll_ballot"."poll_mod_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_poll_mod_unique" ON "vote_poll_mod" USING btree ("poll_id","vote_mod_id");--> statement-breakpoint
CREATE INDEX "idx_vote_submission_vote" ON "vote_submission" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "idx_vote_submission_player" ON "vote_submission" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_submission_active_unique" ON "vote_submission" USING btree ("vote_id","discord_id") WHERE "vote_submission"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_vote_submission_upvote_player" ON "vote_submission_upvote" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vote_submission_upvote_unique" ON "vote_submission_upvote" USING btree ("submission_id","discord_id");