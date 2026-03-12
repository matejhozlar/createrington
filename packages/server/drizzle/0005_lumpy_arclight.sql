CREATE TABLE "crypto_market_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"token_id" integer,
	"severity" "crypto_event_severity" DEFAULT 'info' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"active_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_portfolio_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"total_value" numeric(20, 8) NOT NULL,
	"total_invested" numeric(20, 8) NOT NULL,
	"realized_pnl" numeric(20, 8) DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_price_alert" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_id" integer NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"direction" "crypto_alert_direction" NOT NULL,
	"triggered" boolean DEFAULT false NOT NULL,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crypto_market_event" ADD CONSTRAINT "crypto_market_event_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_portfolio_snapshot" ADD CONSTRAINT "crypto_portfolio_snapshot_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_price_alert" ADD CONSTRAINT "crypto_price_alert_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_price_alert" ADD CONSTRAINT "crypto_price_alert_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_watchlist" ADD CONSTRAINT "crypto_watchlist_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_watchlist" ADD CONSTRAINT "crypto_watchlist_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crypto_market_event_recent" ON "crypto_market_event" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crypto_portfolio_snapshot_player" ON "crypto_portfolio_snapshot" USING btree ("player_minecraft_uuid","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crypto_alert_pending" ON "crypto_price_alert" USING btree ("token_id","triggered") WHERE "crypto_price_alert"."triggered" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crypto_watchlist_unique" ON "crypto_watchlist" USING btree ("player_minecraft_uuid","token_id");