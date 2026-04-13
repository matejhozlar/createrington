CREATE TABLE "server_forceload_chunk" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer,
	"party_id" integer,
	"dimension" varchar(255) NOT NULL,
	"x" integer NOT NULL,
	"z" integer NOT NULL,
	"active" boolean NOT NULL,
	CONSTRAINT "chk_forceload_chunk_owner" CHECK (("server_forceload_chunk"."player_id" IS NULL) <> ("server_forceload_chunk"."party_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "server_forceload_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"player_uuid" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_forceload_party" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"party_id" uuid NOT NULL,
	"party_name" varchar(255) NOT NULL,
	"member_count" integer NOT NULL,
	"opted_in" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_forceload_player" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"player_uuid" uuid NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_forceload_chunk" ADD CONSTRAINT "server_forceload_chunk_player_id_server_forceload_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."server_forceload_player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_forceload_chunk" ADD CONSTRAINT "server_forceload_chunk_party_id_server_forceload_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."server_forceload_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_forceload_member" ADD CONSTRAINT "server_forceload_member_party_id_server_forceload_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."server_forceload_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_forceload_party" ADD CONSTRAINT "server_forceload_party_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_forceload_player" ADD CONSTRAINT "server_forceload_player_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_server_forceload_chunk_player" ON "server_forceload_chunk" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_server_forceload_chunk_party" ON "server_forceload_chunk" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "idx_server_forceload_member_party" ON "server_forceload_member" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "idx_server_forceload_member_player" ON "server_forceload_member" USING btree ("player_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_forceload_party_unique" ON "server_forceload_party" USING btree ("server_id","party_id");--> statement-breakpoint
CREATE INDEX "idx_server_forceload_party_server" ON "server_forceload_party" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_forceload_player_unique" ON "server_forceload_player" USING btree ("server_id","player_uuid");--> statement-breakpoint
CREATE INDEX "idx_server_forceload_player_server" ON "server_forceload_player" USING btree ("server_id");