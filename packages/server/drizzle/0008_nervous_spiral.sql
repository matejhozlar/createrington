ALTER TABLE "crypto_cost_basis" DROP CONSTRAINT "crypto_cost_basis_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_holding" DROP CONSTRAINT "crypto_holding_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_order" DROP CONSTRAINT "crypto_order_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_portfolio_snapshot" DROP CONSTRAINT "crypto_portfolio_snapshot_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_price_alert" DROP CONSTRAINT "crypto_price_alert_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_transaction" DROP CONSTRAINT "crypto_transaction_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_watchlist" DROP CONSTRAINT "crypto_watchlist_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "reward_claim" DROP CONSTRAINT "reward_claim_player_minecraft_uuid_player_minecraft_uuid_fk";
--> statement-breakpoint
ALTER TABLE "crypto_cost_basis" ADD CONSTRAINT "crypto_cost_basis_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_holding" ADD CONSTRAINT "crypto_holding_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_order" ADD CONSTRAINT "crypto_order_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_portfolio_snapshot" ADD CONSTRAINT "crypto_portfolio_snapshot_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_price_alert" ADD CONSTRAINT "crypto_price_alert_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_transaction" ADD CONSTRAINT "crypto_transaction_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_watchlist" ADD CONSTRAINT "crypto_watchlist_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_ban" ADD CONSTRAINT "player_ban_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reward_claim" ADD CONSTRAINT "reward_claim_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;