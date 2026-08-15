CREATE TABLE "workshop_ban" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"workshop_id" integer,
	"ban_type" "ban_type" NOT NULL,
	"reason" text NOT NULL,
	"banned_by_discord_id" text NOT NULL,
	"banned_by_username" text NOT NULL,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"unbanned" boolean DEFAULT false NOT NULL,
	"unbanned_by_discord_id" text,
	"unbanned_by_username" text,
	"unbanned_at" timestamp with time zone,
	"unban_reason" text,
	CONSTRAINT "chk_workshop_ban_expiry" CHECK (("workshop_ban"."ban_type" = 'permanent' AND "workshop_ban"."expires_at" IS NULL) OR ("workshop_ban"."ban_type" = 'temporary' AND "workshop_ban"."expires_at" IS NOT NULL AND "workshop_ban"."expires_at" > "workshop_ban"."banned_at")),
	CONSTRAINT "chk_workshop_ban_unban_fields" CHECK (("workshop_ban"."unbanned" = false AND "workshop_ban"."unbanned_by_discord_id" IS NULL AND "workshop_ban"."unbanned_by_username" IS NULL AND "workshop_ban"."unbanned_at" IS NULL AND "workshop_ban"."unban_reason" IS NULL) OR ("workshop_ban"."unbanned" = true AND "workshop_ban"."unbanned_by_discord_id" IS NOT NULL AND "workshop_ban"."unbanned_by_username" IS NOT NULL AND "workshop_ban"."unbanned_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "workshop_ban" ADD CONSTRAINT "workshop_ban_workshop_id_workshop_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workshop_ban_active" ON "workshop_ban" USING btree ("discord_id","workshop_id") WHERE unbanned = false;--> statement-breakpoint
CREATE INDEX "idx_workshop_ban_workshop" ON "workshop_ban" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "idx_workshop_ban_banned_at" ON "workshop_ban" USING btree ("banned_at" DESC NULLS LAST);