CREATE TABLE "server_ally_fake_party" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"party_id" uuid NOT NULL,
	"owner_uuid" uuid NOT NULL,
	"owner_name" varchar(255) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_ally_fake_party_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"fake_party_id" integer NOT NULL,
	"player_uuid" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_ally_party" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"party_id" uuid NOT NULL,
	"allied_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_ally_qualified_player" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"player_uuid" uuid NOT NULL,
	"qualified_at" timestamp with time zone NOT NULL,
	"is_pending" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_ally_fake_party" ADD CONSTRAINT "server_ally_fake_party_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_ally_fake_party_member" ADD CONSTRAINT "server_ally_fake_party_member_fake_party_id_server_ally_fake_party_id_fk" FOREIGN KEY ("fake_party_id") REFERENCES "public"."server_ally_fake_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_ally_party" ADD CONSTRAINT "server_ally_party_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_ally_qualified_player" ADD CONSTRAINT "server_ally_qualified_player_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_ally_fake_party_server" ON "server_ally_fake_party" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_server_ally_fake_party_member_party" ON "server_ally_fake_party_member" USING btree ("fake_party_id");--> statement-breakpoint
CREATE INDEX "idx_server_ally_fake_party_member_player" ON "server_ally_fake_party_member" USING btree ("player_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_ally_party_unique" ON "server_ally_party" USING btree ("server_id","party_id");--> statement-breakpoint
CREATE INDEX "idx_server_ally_party_server" ON "server_ally_party" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_ally_qualified_player_unique" ON "server_ally_qualified_player" USING btree ("server_id","player_uuid");--> statement-breakpoint
CREATE INDEX "idx_server_ally_qualified_player_server" ON "server_ally_qualified_player" USING btree ("server_id");