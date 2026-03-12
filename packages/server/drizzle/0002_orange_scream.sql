CREATE TYPE "public"."crypto_alert_direction" AS ENUM('above', 'below');--> statement-breakpoint
CREATE TYPE "public"."crypto_event_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."crypto_order_status" AS ENUM('pending', 'filled', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."crypto_order_type" AS ENUM('limit_buy', 'limit_sell', 'stop_loss', 'take_profit');--> statement-breakpoint
CREATE TYPE "public"."crypto_price_interval" AS ENUM('tick', 'minute', 'hourly', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."crypto_token_category" AS ENUM('stable', 'blue_chip', 'memecoin', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."crypto_trade_trigger" AS ENUM('market', 'limit', 'stop_loss', 'take_profit', 'auto_delist');--> statement-breakpoint
CREATE TYPE "public"."crypto_trade_type" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "crypto_holding" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"total_cost_basis" numeric(20, 8) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_crypto_holding_amount" CHECK ("crypto_holding"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "crypto_price_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" integer NOT NULL,
	"interval" "crypto_price_interval" NOT NULL,
	"open_price" numeric(20, 8) NOT NULL,
	"high_price" numeric(20, 8) NOT NULL,
	"low_price" numeric(20, 8) NOT NULL,
	"close_price" numeric(20, 8) NOT NULL,
	"volume" bigint DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"description" text,
	"category" "crypto_token_category" NOT NULL,
	"total_supply" bigint NOT NULL,
	"available_supply" bigint NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"floor_price" numeric(20, 8),
	"is_crashed" boolean DEFAULT false NOT NULL,
	"crashed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delisted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "crypto_token_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "crypto_transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_id" integer NOT NULL,
	"type" "crypto_trade_type" NOT NULL,
	"trigger" "crypto_trade_trigger" DEFAULT 'market' NOT NULL,
	"amount" bigint NOT NULL,
	"price_at_execution" numeric(20, 8) NOT NULL,
	"fee_amount" numeric(20, 8) DEFAULT 0 NOT NULL,
	"total_cost" numeric(20, 8) NOT NULL,
	"realized_pnl" numeric(20, 8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_treasury" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_collected" numeric(20, 8) DEFAULT 0 NOT NULL,
	"total_burned" numeric(20, 8) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crypto_holding" ADD CONSTRAINT "crypto_holding_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_holding" ADD CONSTRAINT "crypto_holding_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_price_snapshot" ADD CONSTRAINT "crypto_price_snapshot_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_transaction" ADD CONSTRAINT "crypto_transaction_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_transaction" ADD CONSTRAINT "crypto_transaction_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crypto_holding_player_token" ON "crypto_holding" USING btree ("player_minecraft_uuid","token_id");--> statement-breakpoint
CREATE INDEX "idx_crypto_holding_player" ON "crypto_holding" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_crypto_holding_token" ON "crypto_holding" USING btree ("token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crypto_price_snapshot_unique" ON "crypto_price_snapshot" USING btree ("token_id","interval","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_crypto_price_snapshot_lookup" ON "crypto_price_snapshot" USING btree ("token_id","interval","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_crypto_transaction_player" ON "crypto_transaction" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_crypto_transaction_token_time" ON "crypto_transaction" USING btree ("token_id","created_at" DESC NULLS LAST);