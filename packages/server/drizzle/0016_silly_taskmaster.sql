ALTER TABLE "crypto_cost_basis" DROP CONSTRAINT "crypto_cost_basis_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_holding" DROP CONSTRAINT "crypto_holding_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_market_event" DROP CONSTRAINT "crypto_market_event_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_order" DROP CONSTRAINT "crypto_order_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_price_alert" DROP CONSTRAINT "crypto_price_alert_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_price_snapshot" DROP CONSTRAINT "crypto_price_snapshot_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_transaction" DROP CONSTRAINT "crypto_transaction_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_watchlist" DROP CONSTRAINT "crypto_watchlist_token_id_crypto_token_id_fk";
--> statement-breakpoint
ALTER TABLE "crypto_cost_basis" ADD CONSTRAINT "crypto_cost_basis_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_holding" ADD CONSTRAINT "crypto_holding_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_market_event" ADD CONSTRAINT "crypto_market_event_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_order" ADD CONSTRAINT "crypto_order_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_price_alert" ADD CONSTRAINT "crypto_price_alert_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_price_snapshot" ADD CONSTRAINT "crypto_price_snapshot_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_transaction" ADD CONSTRAINT "crypto_transaction_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crypto_watchlist" ADD CONSTRAINT "crypto_watchlist_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE cascade ON UPDATE cascade;