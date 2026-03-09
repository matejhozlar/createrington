CREATE TYPE "public"."ban_type" AS ENUM('temporary', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."strike_classification" AS ENUM('pvp', 'theft', 'griefing', 'laggy_machines', 'inappropriate_chat', 'harassment', 'exploiting', 'rule_violation', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'closed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."ticket_type" AS ENUM('general', 'report');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('pending', 'auto_accepted', 'accepted', 'declined', 'completed');--> statement-breakpoint
CREATE TABLE "admin" (
	"discord_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"vanished" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "admin_log_action" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_discord_id" text NOT NULL,
	"admin_username" text NOT NULL,
	"action_type" text NOT NULL,
	"target_player_uuid" uuid NOT NULL,
	"target_player_name" text NOT NULL,
	"table_name" text NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"server_id" integer,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text,
	"discord_avatar" text,
	"token_hash" text NOT NULL,
	"family_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "discord_embed_preset" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_embed_preset_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "discord_guild_member_join" (
	"join_number" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"username" varchar(32) NOT NULL,
	"joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "discord_guild_member_join_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "discord_guild_member_leave" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"minecraft_username" text NOT NULL,
	"departed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notification_message_id" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "discord_guild_member_leave_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "faq_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_mode" varchar(20) DEFAULT 'keywords' NOT NULL,
	"pattern" text NOT NULL,
	"title" varchar(100) NOT NULL,
	"response" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_welcome_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faq_welcome_message_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"leaderboard_type" varchar(50) NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"last_refreshed" timestamp with time zone DEFAULT now(),
	"last_manual_refresh" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leaderboard_message_leaderboard_type_unique" UNIQUE("leaderboard_type")
);
--> statement-breakpoint
CREATE TABLE "lottery_participant" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lottery_participant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"minecraft_uuid" uuid NOT NULL,
	"minecraft_username" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" serial PRIMARY KEY NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"minecraft_username" text NOT NULL,
	"discord_id" text NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_server_id" integer,
	CONSTRAINT "player_minecraft_uuid_unique" UNIQUE("minecraft_uuid"),
	CONSTRAINT "player_minecraft_username_unique" UNIQUE("minecraft_username"),
	CONSTRAINT "player_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "player_achievement" (
	"minecraft_uuid" uuid NOT NULL,
	"server_id" integer NOT NULL,
	"achievement_group_id" text NOT NULL,
	"tier" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"reward_amount" integer NOT NULL,
	CONSTRAINT "player_achievement_minecraft_uuid_server_id_achievement_group_id_tier_pk" PRIMARY KEY("minecraft_uuid","server_id","achievement_group_id","tier"),
	CONSTRAINT "chk_tier_positive" CHECK ("player_achievement"."tier" > 0),
	CONSTRAINT "chk_reward_non_negative" CHECK ("player_achievement"."reward_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_balance" (
	"minecraft_uuid" uuid PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_balance_non_negative" CHECK ("player_balance"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_balance_transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"transaction_type" text NOT NULL,
	"description" text,
	"related_player_uuid" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_ban" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_ban_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_minecraft_uuid" uuid NOT NULL,
	"ban_type" "ban_type" NOT NULL,
	"reason" text NOT NULL,
	"banned_by_discord_id" text NOT NULL,
	"banned_by_username" text NOT NULL,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"unbanned" boolean DEFAULT false NOT NULL,
	"unbanned_by_discord_id" text,
	"unbanned_by_username" text,
	"unbanned_at" timestamp with time zone,
	"unban_reason" text,
	"server_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "chk_ban_expiry" CHECK (("player_ban"."ban_type" = 'permanent' AND "player_ban"."expires_at" IS NULL) OR ("player_ban"."ban_type" = 'temporary' AND "player_ban"."expires_at" IS NOT NULL AND "player_ban"."expires_at" > "player_ban"."banned_at")),
	CONSTRAINT "chk_unban_fields" CHECK (("player_ban"."unbanned" = false AND "player_ban"."unbanned_by_discord_id" IS NULL AND "player_ban"."unbanned_by_username" IS NULL AND "player_ban"."unbanned_at" IS NULL AND "player_ban"."unban_reason" IS NULL) OR ("player_ban"."unbanned" = true AND "player_ban"."unbanned_by_discord_id" IS NOT NULL AND "player_ban"."unbanned_by_username" IS NOT NULL AND "player_ban"."unbanned_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "player_minecraft_stats" (
	"minecraft_uuid" uuid NOT NULL,
	"server_id" integer NOT NULL,
	"stats" jsonb NOT NULL,
	"data_version" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_minecraft_stats_minecraft_uuid_server_id_pk" PRIMARY KEY("minecraft_uuid","server_id")
);
--> statement-breakpoint
CREATE TABLE "player_playtime_daily" (
	"player_minecraft_uuid" uuid NOT NULL,
	"server_id" integer NOT NULL,
	"play_date" date NOT NULL,
	"seconds_played" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "player_playtime_daily_player_minecraft_uuid_server_id_play_date_pk" PRIMARY KEY("player_minecraft_uuid","server_id","play_date")
);
--> statement-breakpoint
CREATE TABLE "player_playtime_hourly" (
	"player_minecraft_uuid" uuid NOT NULL,
	"server_id" integer NOT NULL,
	"play_hour" timestamp with time zone NOT NULL,
	"seconds_played" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "player_playtime_hourly_player_minecraft_uuid_server_id_play_hour_pk" PRIMARY KEY("player_minecraft_uuid","server_id","play_hour")
);
--> statement-breakpoint
CREATE TABLE "player_playtime_summary" (
	"player_minecraft_uuid" uuid NOT NULL,
	"server_id" integer NOT NULL,
	"total_seconds" bigint DEFAULT 0 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone,
	"last_seen" timestamp with time zone,
	"avg_session_seconds" bigint GENERATED ALWAYS AS (CASE WHEN total_sessions > 0 THEN total_seconds / total_sessions ELSE 0 END) STORED,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_playtime_summary_player_minecraft_uuid_server_id_pk" PRIMARY KEY("player_minecraft_uuid","server_id")
);
--> statement-breakpoint
CREATE TABLE "player_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"server_id" integer NOT NULL,
	"session_start" timestamp with time zone NOT NULL,
	"session_end" timestamp with time zone,
	"seconds_played" bigint GENERATED ALWAYS AS (CASE WHEN session_end IS NOT NULL THEN EXTRACT(epoch FROM (session_end - session_start))::bigint ELSE NULL END) STORED,
	CONSTRAINT "chk_session_end_after_start" CHECK ("player_session"."session_end" IS NULL OR "player_session"."session_end" >= "player_session"."session_start")
);
--> statement-breakpoint
CREATE TABLE "player_strike" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"classification" "strike_classification" NOT NULL,
	"description" text NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"issued_by_discord_id" text NOT NULL,
	"issued_by_username" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed" boolean DEFAULT false NOT NULL,
	"removed_by_discord_id" text,
	"removed_by_username" text,
	"removed_at" timestamp with time zone,
	"removal_reason" text,
	"server_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "chk_removed_fields" CHECK (("player_strike"."removed" = false AND "player_strike"."removed_by_discord_id" IS NULL AND "player_strike"."removed_by_username" IS NULL AND "player_strike"."removed_at" IS NULL AND "player_strike"."removal_reason" IS NULL) OR ("player_strike"."removed" = true AND "player_strike"."removed_by_discord_id" IS NOT NULL AND "player_strike"."removed_by_username" IS NOT NULL AND "player_strike"."removed_at" IS NOT NULL)),
	CONSTRAINT "player_strike_severity_check" CHECK ("player_strike"."severity" >= 1 AND "player_strike"."severity" <= 5)
);
--> statement-breakpoint
CREATE TABLE "reward_claim" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_minecraft_uuid" uuid NOT NULL,
	"reward_type" varchar(50) NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" bigint NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "server" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"identifier" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_name_unique" UNIQUE("name"),
	CONSTRAINT "server_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" integer NOT NULL,
	"type" "ticket_type" NOT NULL,
	"creator_discord_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_discord_id" text,
	"deleted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "ticket_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_action" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"action_type" text NOT NULL,
	"performed_by_discord_id" text NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "waitlist_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"discord_name" text NOT NULL,
	"discord_id" text,
	"token" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discord_message_id" text,
	"status" "waitlist_status" DEFAULT 'pending' NOT NULL,
	"joined_discord" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"registered" boolean DEFAULT false NOT NULL,
	"joined_minecraft" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"metadata" jsonb,
	CONSTRAINT "waitlist_entry_discord_name_unique" UNIQUE("discord_name"),
	CONSTRAINT "waitlist_entry_discord_id_unique" UNIQUE("discord_id"),
	CONSTRAINT "waitlist_entry_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "admin" ADD CONSTRAINT "admin_discord_id_player_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."player"("discord_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_discord_id_player_discord_id_fk" FOREIGN KEY ("discord_id") REFERENCES "public"."player"("discord_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lottery_participant" ADD CONSTRAINT "lottery_participant_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_current_server_id_server_id_fk" FOREIGN KEY ("current_server_id") REFERENCES "public"."server"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_achievement" ADD CONSTRAINT "player_achievement_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_achievement" ADD CONSTRAINT "player_achievement_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_balance" ADD CONSTRAINT "player_balance_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_balance_transaction" ADD CONSTRAINT "player_balance_transaction_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_balance_transaction" ADD CONSTRAINT "player_balance_transaction_related_player_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("related_player_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_ban" ADD CONSTRAINT "player_ban_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_minecraft_stats" ADD CONSTRAINT "player_minecraft_stats_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_minecraft_stats" ADD CONSTRAINT "player_minecraft_stats_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_playtime_daily" ADD CONSTRAINT "player_playtime_daily_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_playtime_daily" ADD CONSTRAINT "player_playtime_daily_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_playtime_hourly" ADD CONSTRAINT "player_playtime_hourly_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_playtime_hourly" ADD CONSTRAINT "player_playtime_hourly_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_playtime_summary" ADD CONSTRAINT "player_playtime_summary_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_playtime_summary" ADD CONSTRAINT "player_playtime_summary_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_session" ADD CONSTRAINT "player_session_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_session" ADD CONSTRAINT "player_session_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_strike" ADD CONSTRAINT "player_strike_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_strike" ADD CONSTRAINT "player_strike_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reward_claim" ADD CONSTRAINT "reward_claim_player_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("player_minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_action" ADD CONSTRAINT "ticket_action_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_log_actions_admin" ON "admin_log_action" USING btree ("admin_discord_id");--> statement-breakpoint
CREATE INDEX "idx_log_actions_action_type" ON "admin_log_action" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_log_actions_table_name" ON "admin_log_action" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_log_actions_target" ON "admin_log_action" USING btree ("target_player_uuid");--> statement-breakpoint
CREATE INDEX "idx_log_actions_performed_at" ON "admin_log_action" USING btree ("performed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_auth_session_discord_id" ON "auth_session" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "idx_auth_session_token_hash" ON "auth_session" USING btree ("token_hash") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_auth_session_expires_at" ON "auth_session" USING btree ("expires_at") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_auth_session_family_id" ON "auth_session" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_discord_guild_member_join_joined_at" ON "discord_guild_member_join" USING btree ("joined_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_discord_guild_member_leave_discord_id" ON "discord_guild_member_leave" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "idx_discord_guild_member_leave_minecraft_uuid" ON "discord_guild_member_leave" USING btree ("minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_discord_guild_member_leave_departed_at" ON "discord_guild_member_leave" USING btree ("departed_at");--> statement-breakpoint
CREATE INDEX "idx_discord_guild_member_leave_deleted_at" ON "discord_guild_member_leave" USING btree ("departed_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_faq_entry_enabled" ON "faq_entry" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_faq_entry_priority" ON "faq_entry" USING btree ("priority" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_leaderboard_type" ON "leaderboard_message" USING btree ("leaderboard_type");--> statement-breakpoint
CREATE INDEX "idx_player_discord_id" ON "player" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "idx_player_minecraft_uuid" ON "player" USING btree ("minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_player_minecraft_username" ON "player" USING btree ("minecraft_username");--> statement-breakpoint
CREATE INDEX "idx_player_last_seen" ON "player" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "idx_player_achievement_player_server" ON "player_achievement" USING btree ("minecraft_uuid","server_id");--> statement-breakpoint
CREATE INDEX "idx_player_achievement_unclaimed" ON "player_achievement" USING btree ("minecraft_uuid","server_id") WHERE claimed_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_player_balance_uuid" ON "player_balance" USING btree ("minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_player_balance_amount" ON "player_balance" USING btree ("balance" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_balance_transaction_player" ON "player_balance_transaction" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_balance_transaction_type" ON "player_balance_transaction" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_balance_transaction_created" ON "player_balance_transaction" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_balance_transaction_related" ON "player_balance_transaction" USING btree ("related_player_uuid") WHERE related_player_uuid IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_player_ban_player" ON "player_ban" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_player_ban_type" ON "player_ban" USING btree ("ban_type");--> statement-breakpoint
CREATE INDEX "idx_player_ban_banned_at" ON "player_ban" USING btree ("banned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_player_ban_banned_by" ON "player_ban" USING btree ("banned_by_discord_id");--> statement-breakpoint
CREATE INDEX "idx_player_ban_expires" ON "player_ban" USING btree ("expires_at") WHERE expires_at IS NOT NULL AND unbanned = false;--> statement-breakpoint
CREATE INDEX "idx_player_ban_active" ON "player_ban" USING btree ("unbanned") WHERE unbanned = false;--> statement-breakpoint
CREATE INDEX "idx_player_minecraft_stats_server" ON "player_minecraft_stats" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_player_playtime_daily_date" ON "player_playtime_daily" USING btree ("play_date");--> statement-breakpoint
CREATE INDEX "idx_player_playtime_hourly_date" ON "player_playtime_hourly" USING btree ("play_hour");--> statement-breakpoint
CREATE INDEX "idx_player_playtime_hourly_player_date" ON "player_playtime_hourly" USING btree ("player_minecraft_uuid","play_hour");--> statement-breakpoint
CREATE INDEX "idx_player_playtime_summary_total" ON "player_playtime_summary" USING btree ("total_seconds" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_player_session_player" ON "player_session" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_player_session_server" ON "player_session" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_player_session_start" ON "player_session" USING btree ("session_start");--> statement-breakpoint
CREATE INDEX "idx_player_session_active" ON "player_session" USING btree ("player_minecraft_uuid","server_id") WHERE session_end IS NULL;--> statement-breakpoint
CREATE INDEX "idx_player_session_date_range" ON "player_session" USING btree ("player_minecraft_uuid","session_start","session_end");--> statement-breakpoint
CREATE INDEX "idx_player_strike_player" ON "player_strike" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_player_strike_classification" ON "player_strike" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "idx_player_strike_issued_at" ON "player_strike" USING btree ("issued_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_player_strike_severity" ON "player_strike" USING btree ("severity" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_player_strike_removed" ON "player_strike" USING btree ("removed") WHERE removed = false;--> statement-breakpoint
CREATE INDEX "idx_player_strike_server" ON "player_strike" USING btree ("server_id") WHERE server_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_claim_player_type_claimed" ON "reward_claim" USING btree ("player_minecraft_uuid","reward_type","claimed_at");--> statement-breakpoint
CREATE INDEX "idx_reward_claim_player" ON "reward_claim" USING btree ("player_minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_reward_claim_type" ON "reward_claim" USING btree ("reward_type");--> statement-breakpoint
CREATE INDEX "idx_reward_claim_claimed_at" ON "reward_claim" USING btree ("claimed_at");--> statement-breakpoint
CREATE INDEX "idx_reward_claim_player_type" ON "reward_claim" USING btree ("player_minecraft_uuid","reward_type");--> statement-breakpoint
CREATE INDEX "idx_ticket_channel" ON "ticket" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_creator" ON "ticket" USING btree ("creator_discord_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_status" ON "ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ticket_type" ON "ticket" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_ticket_action_ticket" ON "ticket_action" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_action_type" ON "ticket_action" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_waitlist_discord_message_id" ON "waitlist_entry" USING btree ("discord_message_id");--> statement-breakpoint
CREATE INDEX "idx_waitlist_status" ON "waitlist_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_waitlist_submitted_at" ON "waitlist_entry" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "idx_waitlist_token" ON "waitlist_entry" USING btree ("token");