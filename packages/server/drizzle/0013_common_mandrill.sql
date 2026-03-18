CREATE TABLE "discord_command_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"command_name" varchar(100) NOT NULL,
	"discord_id" varchar(50) NOT NULL,
	"success" boolean NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_discord_command_usage_command" ON "discord_command_usage" USING btree ("command_name");--> statement-breakpoint
CREATE INDEX "idx_discord_command_usage_executed_at" ON "discord_command_usage" USING btree ("executed_at");