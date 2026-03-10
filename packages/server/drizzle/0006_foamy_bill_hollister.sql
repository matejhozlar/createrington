ALTER TABLE "crypto_token" ADD COLUMN "ipo_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crypto_token" ADD COLUMN "ipo_price" numeric(20, 8);