ALTER TABLE "waitlist_entry" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing rows would otherwise all read as signing up the moment this ran.
-- queued_at is exact for entries that never went back in line, and the last
-- re-queue for the rest; registered_at survives a rejoin and is the older
-- lower bound whenever it is present.
UPDATE "waitlist_entry" SET "created_at" = LEAST("queued_at", COALESCE("registered_at", "queued_at"));
