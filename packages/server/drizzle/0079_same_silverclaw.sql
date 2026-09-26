DROP INDEX "idx_auth_session_token_hash";--> statement-breakpoint
DROP INDEX "idx_donation_stripe_session";--> statement-breakpoint
DROP INDEX "idx_leaderboard_type";--> statement-breakpoint
DROP INDEX "idx_workshop_mod_event_workshop";--> statement-breakpoint
DROP INDEX "idx_balance_transaction_player";--> statement-breakpoint
DROP INDEX "idx_player_session_server";--> statement-breakpoint
DROP INDEX "idx_server_chunk_player";--> statement-breakpoint
CREATE INDEX "idx_player_playtime_daily_server_date" ON "player_playtime_daily" USING btree ("server_id","play_date");--> statement-breakpoint
CREATE INDEX "idx_player_playtime_hourly_server_date" ON "player_playtime_hourly" USING btree ("server_id","play_hour");--> statement-breakpoint
CREATE INDEX "idx_workshop_mod_event_workshop_created" ON "workshop_mod_event" USING btree ("workshop_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_balance_transaction_player" ON "player_balance_transaction" USING btree ("player_minecraft_uuid","id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_player_session_server" ON "player_session" USING btree ("server_id","session_start" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_server_chunk_player" ON "server_chunk" USING btree ("player_uuid","original_player_uuid");