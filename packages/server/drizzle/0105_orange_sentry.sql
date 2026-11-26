ALTER TABLE "donation" ALTER COLUMN "stripe_session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "donation" ADD COLUMN "stripe_invoice_id" text;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id");