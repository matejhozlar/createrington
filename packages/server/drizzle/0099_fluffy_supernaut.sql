CREATE TYPE "public"."donation_status" AS ENUM('pending', 'completed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."faq_match_mode" AS ENUM('keywords', 'regex');--> statement-breakpoint
CREATE TYPE "public"."player_balance_transaction_type" AS ENUM('transfer_send', 'transfer_receive', 'deposit', 'withdraw', 'admin_grant', 'admin_deduct', 'admin_set', 'purchase', 'reward', 'refund', 'gallery_reward', 'lottery_entry', 'lottery_win', 'lottery_refund');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('daily');--> statement-breakpoint
CREATE TYPE "public"."server_maintenance_schedule_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ticket_action_type" AS ENUM('created', 'closed', 'reopened', 'deleted', 'transcript_generated');--> statement-breakpoint
DELETE FROM "player_balance_transaction" WHERE "transaction_type" NOT IN ('transfer_send', 'transfer_receive', 'deposit', 'withdraw', 'admin_grant', 'admin_deduct', 'admin_set', 'purchase', 'reward', 'refund', 'gallery_reward', 'lottery_entry', 'lottery_win', 'lottery_refund');--> statement-breakpoint
DELETE FROM "reward_claim" WHERE "reward_type" NOT IN ('daily');--> statement-breakpoint
DELETE FROM "ticket_action" WHERE "action_type" NOT IN ('created', 'closed', 'reopened', 'deleted', 'transcript_generated');--> statement-breakpoint
ALTER TABLE "admin" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "admin" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admin" ALTER COLUMN "vanished" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "donation" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "donation" ALTER COLUMN "status" SET DATA TYPE "public"."donation_status" USING "status"::"public"."donation_status";--> statement-breakpoint
ALTER TABLE "donation" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."donation_status";--> statement-breakpoint
ALTER TABLE "faq_entry" ALTER COLUMN "match_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "faq_entry" ALTER COLUMN "match_mode" SET DATA TYPE "public"."faq_match_mode" USING "match_mode"::"public"."faq_match_mode";--> statement-breakpoint
ALTER TABLE "faq_entry" ALTER COLUMN "match_mode" SET DEFAULT 'keywords'::"public"."faq_match_mode";--> statement-breakpoint
ALTER TABLE "player_balance_transaction" ALTER COLUMN "transaction_type" SET DATA TYPE "public"."player_balance_transaction_type" USING "transaction_type"::"public"."player_balance_transaction_type";--> statement-breakpoint
ALTER TABLE "reward_claim" ALTER COLUMN "reward_type" SET DATA TYPE "public"."reward_type" USING "reward_type"::"public"."reward_type";--> statement-breakpoint
DROP INDEX "idx_server_maintenance_schedule_open";--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ALTER COLUMN "status" SET DATA TYPE "public"."server_maintenance_schedule_status" USING "status"::"public"."server_maintenance_schedule_status";--> statement-breakpoint
ALTER TABLE "server_maintenance_schedule" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"public"."server_maintenance_schedule_status";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_maintenance_schedule_open" ON "server_maintenance_schedule" USING btree ("server_id") WHERE "server_maintenance_schedule"."status" IN ('scheduled', 'active');--> statement-breakpoint
ALTER TABLE "ticket_action" ALTER COLUMN "action_type" SET DATA TYPE "public"."ticket_action_type" USING "action_type"::"public"."ticket_action_type";
