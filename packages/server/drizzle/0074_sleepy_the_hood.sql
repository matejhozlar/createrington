CREATE TABLE "discord_top_role" (
	"role_key" text PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"value" numeric(20, 3) NOT NULL,
	"held_since" timestamp with time zone NOT NULL,
	"image_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
