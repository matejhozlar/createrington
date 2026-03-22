CREATE TYPE "public"."donation_type" AS ENUM('one_time', 'monthly');--> statement-breakpoint
CREATE TABLE "donation" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_discord_id" text NOT NULL,
	"type" "donation_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"stripe_session_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"supporter_role_granted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "donation_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_player_discord_id_player_discord_id_fk" FOREIGN KEY ("player_discord_id") REFERENCES "public"."player"("discord_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_donation_player" ON "donation" USING btree ("player_discord_id");--> statement-breakpoint
CREATE INDEX "idx_donation_stripe_session" ON "donation" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "idx_donation_created_at" ON "donation" USING btree ("created_at" DESC NULLS LAST);
