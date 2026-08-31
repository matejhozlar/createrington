CREATE TABLE "player_balance_idempotency" (
	"player_minecraft_uuid" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_balance_idempotency_player_minecraft_uuid_idempotency_key_pk" PRIMARY KEY("player_minecraft_uuid","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "player_balance_transaction" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "player_balance_idempotency" ADD CONSTRAINT "player_balance_idempotency_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_balance_idempotency_created" ON "player_balance_idempotency" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_balance_transaction_idempotency_key" ON "player_balance_transaction" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;