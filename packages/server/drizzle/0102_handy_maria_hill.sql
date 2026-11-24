CREATE TABLE "planning_item_category" (
	"item_id" integer NOT NULL,
	"category" "planning_category" NOT NULL,
	CONSTRAINT "planning_item_category_item_id_category_pk" PRIMARY KEY("item_id","category")
);
--> statement-breakpoint
CREATE TABLE "planning_item_revision_category" (
	"revision_id" integer NOT NULL,
	"category" "planning_category" NOT NULL,
	CONSTRAINT "planning_item_revision_category_revision_id_category_pk" PRIMARY KEY("revision_id","category")
);
--> statement-breakpoint
CREATE TABLE "planning_item_revision_subcategory" (
	"revision_id" integer NOT NULL,
	"subcategory_id" integer NOT NULL,
	CONSTRAINT "planning_item_revision_subcategory_revision_id_subcategory_id_pk" PRIMARY KEY("revision_id","subcategory_id")
);
--> statement-breakpoint
CREATE TABLE "planning_item_subcategory" (
	"item_id" integer NOT NULL,
	"subcategory_id" integer NOT NULL,
	CONSTRAINT "planning_item_subcategory_item_id_subcategory_id_pk" PRIMARY KEY("item_id","subcategory_id")
);
--> statement-breakpoint
ALTER TABLE "planning_item" DROP CONSTRAINT "planning_item_subcategory_id_planning_subcategory_id_fk";
--> statement-breakpoint
DROP INDEX "idx_planning_item_category";--> statement-breakpoint
ALTER TABLE "planning_item_category" ADD CONSTRAINT "planning_item_category_item_id_planning_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."planning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_revision_category" ADD CONSTRAINT "planning_item_revision_category_revision_id_planning_item_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."planning_item_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_revision_subcategory" ADD CONSTRAINT "planning_item_revision_subcategory_revision_id_planning_item_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."planning_item_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_subcategory" ADD CONSTRAINT "planning_item_subcategory_item_id_planning_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."planning_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_item_subcategory" ADD CONSTRAINT "planning_item_subcategory_subcategory_id_planning_subcategory_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."planning_subcategory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_planning_item_category_category" ON "planning_item_category" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_planning_item_subcategory_subcategory" ON "planning_item_subcategory" USING btree ("subcategory_id");--> statement-breakpoint
INSERT INTO "planning_item_category" ("item_id", "category") SELECT "id", "category" FROM "planning_item";--> statement-breakpoint
INSERT INTO "planning_item_subcategory" ("item_id", "subcategory_id") SELECT "id", "subcategory_id" FROM "planning_item" WHERE "subcategory_id" IS NOT NULL;--> statement-breakpoint
INSERT INTO "planning_item_revision_category" ("revision_id", "category") SELECT "id", "category" FROM "planning_item_revision";--> statement-breakpoint
INSERT INTO "planning_item_revision_subcategory" ("revision_id", "subcategory_id") SELECT "id", "subcategory_id" FROM "planning_item_revision" WHERE "subcategory_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "planning_item" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "planning_item" DROP COLUMN "subcategory_id";--> statement-breakpoint
ALTER TABLE "planning_item_revision" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "planning_item_revision" DROP COLUMN "subcategory_id";