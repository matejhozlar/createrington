CREATE TYPE "public"."party_member_rank" AS ENUM('owner', 'officer', 'member');--> statement-breakpoint
CREATE TABLE "server_party" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" integer NOT NULL,
	"free_to_join" boolean DEFAULT false NOT NULL,
	"owner_uuid" uuid NOT NULL,
	"tag_code" text,
	"tag" varchar(4),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_party_ally" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"minecraft_uuid" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_party_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"rank" "party_member_rank" NOT NULL,
	"claim_count" integer,
	"forceload_count" integer
);
--> statement-breakpoint
ALTER TABLE "server_party" ADD CONSTRAINT "server_party_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_party_ally" ADD CONSTRAINT "server_party_ally_party_id_server_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."server_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_party_member" ADD CONSTRAINT "server_party_member_party_id_server_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."server_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_party_unique" ON "server_party" USING btree ("server_id","team_id");--> statement-breakpoint
CREATE INDEX "idx_server_party_tag" ON "server_party" USING btree ("server_id","tag");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_party_ally_unique" ON "server_party_ally" USING btree ("party_id","minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_server_party_ally_player" ON "server_party_ally" USING btree ("minecraft_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_party_member_unique" ON "server_party_member" USING btree ("party_id","minecraft_uuid");--> statement-breakpoint
CREATE INDEX "idx_server_party_member_player" ON "server_party_member" USING btree ("minecraft_uuid");