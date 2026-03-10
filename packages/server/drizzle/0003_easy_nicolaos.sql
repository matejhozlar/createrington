CREATE TABLE "crypto_cost_basis" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_id" integer NOT NULL,
	"amount_remaining" bigint NOT NULL,
	"price_per_unit" numeric(20, 8) NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"token_id" integer NOT NULL,
	"type" "crypto_order_type" NOT NULL,
	"amount" bigint NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"reserved_balance" numeric(20, 8) DEFAULT 0 NOT NULL,
	"reserved_tokens" bigint DEFAULT 0 NOT NULL,
	"status" "crypto_order_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"filled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crypto_cost_basis" ADD CONSTRAINT "crypto_cost_basis_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_cost_basis" ADD CONSTRAINT "crypto_cost_basis_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_order" ADD CONSTRAINT "crypto_order_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_order" ADD CONSTRAINT "crypto_order_token_id_crypto_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."crypto_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crypto_cost_basis_player_token" ON "crypto_cost_basis" USING btree ("player_minecraft_uuid","token_id","acquired_at");--> statement-breakpoint
CREATE INDEX "idx_crypto_order_player_status" ON "crypto_order" USING btree ("player_minecraft_uuid","status");--> statement-breakpoint
CREATE INDEX "idx_crypto_order_token_pending" ON "crypto_order" USING btree ("token_id","status") WHERE "crypto_order"."status" = 'pending';