ALTER TABLE "crypto_transaction" DROP CONSTRAINT "crypto_transaction_order_id_crypto_order_id_fk";
--> statement-breakpoint
DROP INDEX "idx_crypto_holding_player";--> statement-breakpoint
DROP INDEX "idx_player_discord_id";--> statement-breakpoint
DROP INDEX "idx_player_minecraft_uuid";--> statement-breakpoint
DROP INDEX "idx_player_minecraft_username";--> statement-breakpoint
DROP INDEX "idx_player_balance_uuid";--> statement-breakpoint
DROP INDEX "idx_player_session_player";--> statement-breakpoint
DROP INDEX "idx_reward_claim_player";--> statement-breakpoint
DROP INDEX "idx_reward_claim_player_type";--> statement-breakpoint
DROP INDEX "idx_ticket_channel";--> statement-breakpoint
DROP INDEX "idx_waitlist_invite_code";--> statement-breakpoint
ALTER TABLE "crypto_transaction" ADD CONSTRAINT "crypto_transaction_order_id_crypto_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."crypto_order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crypto_transaction_order" ON "crypto_transaction" USING btree ("order_id") WHERE order_id IS NOT NULL;