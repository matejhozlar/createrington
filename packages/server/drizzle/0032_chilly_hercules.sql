DROP INDEX "idx_player_session_active";--> statement-breakpoint
-- Close stacked active sessions before the unique index is created: keep
-- the most recent active row per (player_minecraft_uuid, server_id) and
-- end any older ones at their session_start so they collapse into a
-- valid (and aggregatable) closed session.
UPDATE "player_session" SET "session_end" = "session_start"
WHERE "session_end" IS NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("player_minecraft_uuid", "server_id") "id"
    FROM "player_session"
    WHERE "session_end" IS NULL
    ORDER BY "player_minecraft_uuid", "server_id", "session_start" DESC
  );--> statement-breakpoint
CREATE UNIQUE INDEX "idx_player_session_active" ON "player_session" USING btree ("player_minecraft_uuid","server_id") WHERE session_end IS NULL;
