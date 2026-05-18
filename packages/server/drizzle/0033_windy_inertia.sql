DROP INDEX "reward_claim_player_type_claimed";--> statement-breakpoint
ALTER TABLE "reward_claim" ADD COLUMN "claim_period_key" varchar(32);--> statement-breakpoint
-- Backfill: for the only existing reward type (daily, resetHour=0 UTC) the
-- period key is the UTC date of the claim. If a future row has a different
-- reward type we still get a unique-per-day fallback, which is wrong only
-- for sub-day rewards that don't exist yet.
UPDATE "reward_claim"
SET "claim_period_key" = TO_CHAR(("claimed_at" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
WHERE "claim_period_key" IS NULL;--> statement-breakpoint
ALTER TABLE "reward_claim" ALTER COLUMN "claim_period_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_claim_player_type_period" ON "reward_claim" USING btree ("player_minecraft_uuid","reward_type","claim_period_key");
