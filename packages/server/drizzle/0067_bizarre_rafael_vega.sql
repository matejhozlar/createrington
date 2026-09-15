CREATE TYPE "public"."gallery_submission_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "gallery_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" "gallery_submission_status" DEFAULT 'pending' NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"server_id" integer,
	"caption" text,
	"source_channel_id" text NOT NULL,
	"source_message_id" text NOT NULL,
	"source_attachment_id" text NOT NULL,
	"original_path" text NOT NULL,
	"original_content_type" text NOT NULL,
	"original_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"full_key" text,
	"thumb_key" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"reject_note" text,
	"reward_amount" integer,
	"reward_transaction_id" integer,
	"announcement_channel_id" text,
	"announcement_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_submission_credit" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_submission" ADD CONSTRAINT "gallery_submission_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "gallery_submission" ADD CONSTRAINT "gallery_submission_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_submission" ADD CONSTRAINT "gallery_submission_reward_transaction_id_player_balance_transaction_id_fk" FOREIGN KEY ("reward_transaction_id") REFERENCES "public"."player_balance_transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_submission_credit" ADD CONSTRAINT "gallery_submission_credit_submission_id_gallery_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."gallery_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_submission_credit" ADD CONSTRAINT "gallery_submission_credit_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_gallery_submission_status_created" ON "gallery_submission" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_gallery_submission_player" ON "gallery_submission" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gallery_submission_source" ON "gallery_submission" USING btree ("source_message_id","source_attachment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gallery_submission_credit_unique" ON "gallery_submission_credit" USING btree ("submission_id","player_minecraft_uuid");