CREATE TABLE "discord_auto_message_followup" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"content" text NOT NULL,
	"delay_seconds" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_auto_message_followup" ADD CONSTRAINT "discord_auto_message_followup_message_id_discord_auto_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."discord_auto_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discord_auto_message_followup_message" ON "discord_auto_message_followup" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_discord_auto_message_followup_sort" ON "discord_auto_message_followup" USING btree ("message_id","sort_order");