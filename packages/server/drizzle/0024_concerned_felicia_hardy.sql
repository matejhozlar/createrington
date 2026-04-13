ALTER TABLE "waitlist_entry" DROP CONSTRAINT "waitlist_entry_token_unique";--> statement-breakpoint
DROP INDEX "idx_waitlist_token";--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "discord_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD COLUMN "invite_code" text;--> statement-breakpoint
CREATE INDEX "idx_waitlist_invite_code" ON "waitlist_entry" USING btree ("invite_code");--> statement-breakpoint
ALTER TABLE "waitlist_entry" DROP COLUMN "token";--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_invite_code_unique" UNIQUE("invite_code");