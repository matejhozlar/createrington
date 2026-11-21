CREATE TYPE "public"."planning_category" AS ENUM('modpack', 'website', 'discord', 'server');--> statement-breakpoint
CREATE TYPE "public"."planning_item_status" AS ENUM('inbox', 'discussing', 'decided', 'building', 'done', 'rejected');--> statement-breakpoint
CREATE TABLE "planning_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"category" "planning_category" NOT NULL,
	"subcategory_id" integer,
	"status" "planning_item_status" DEFAULT 'inbox' NOT NULL,
	"decision" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_item_assignee" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"discord_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_item_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"author_discord_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_item_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"revision" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"category" "planning_category" NOT NULL,
	"subcategory_id" integer,
	"status" "planning_item_status" NOT NULL,
	"decision" text,
	"edited_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_subcategory" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "planning_category" NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planning_item" ADD CONSTRAINT "planning_item_subcategory_id_planning_subcategory_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."planning_subcategory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_assignee" ADD CONSTRAINT "planning_item_assignee_item_id_planning_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."planning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_assignee" ADD CONSTRAINT "planning_item_assignee_discord_id_admin_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."admin"("discord_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "planning_item_comment" ADD CONSTRAINT "planning_item_comment_item_id_planning_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."planning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_revision" ADD CONSTRAINT "planning_item_revision_item_id_planning_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."planning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_planning_item_status" ON "planning_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_planning_item_category" ON "planning_item" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_planning_item_assignee_admin" ON "planning_item_assignee" USING btree ("discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_planning_item_assignee_unique" ON "planning_item_assignee" USING btree ("item_id","discord_id");--> statement-breakpoint
CREATE INDEX "idx_planning_item_comment_item" ON "planning_item_comment" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_planning_item_revision_unique" ON "planning_item_revision" USING btree ("item_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_planning_subcategory_category_name" ON "planning_subcategory" USING btree ("category","name");--> statement-breakpoint
INSERT INTO "planning_subcategory" ("category", "name", "position") VALUES
	('modpack', 'Economy', 0),
	('modpack', 'Mods', 1),
	('modpack', 'Recipes and progression', 2),
	('modpack', 'Quests and guide', 3),
	('modpack', 'Performance', 4),
	('website', 'Player features', 0),
	('website', 'Admin', 1),
	('website', 'Launcher', 2),
	('discord', 'Commands', 0),
	('discord', 'Roles and channels', 1),
	('discord', 'Tickets', 2),
	('server', 'World', 0),
	('server', 'Rules', 1),
	('server', 'Events', 2),
	('server', 'Schedule', 3);
