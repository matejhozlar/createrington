ALTER TABLE "admin_log_action" ALTER COLUMN "target_player_uuid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_log_action" ALTER COLUMN "target_player_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_log_action" ALTER COLUMN "table_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_log_action" ALTER COLUMN "field_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_log_action" ADD COLUMN "description" text;