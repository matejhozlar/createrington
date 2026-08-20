ALTER TABLE "waitlist_entry" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing rows would otherwise all read as signing up the moment this ran.
-- queued_at is the closest thing to a signup time we kept: it is exact for
-- entries that never went back in line, and the last re-queue for the rest.
UPDATE "waitlist_entry" SET "created_at" = "queued_at";
