CREATE TABLE "server_chunk" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"dimension" varchar(255) NOT NULL,
	"x" integer NOT NULL,
	"z" integer NOT NULL,
	"player_uuid" uuid NOT NULL,
	"original_player_uuid" uuid NOT NULL,
	"party_id" uuid,
	"party_name" varchar(255),
	"party_opted_in" boolean,
	"forceloadable" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_chunk" ADD CONSTRAINT "server_chunk_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_chunk_unique" ON "server_chunk" USING btree ("server_id","dimension","x","z");
--> statement-breakpoint
CREATE INDEX "idx_server_chunk_server" ON "server_chunk" USING btree ("server_id");
--> statement-breakpoint
CREATE INDEX "idx_server_chunk_player" ON "server_chunk" USING btree ("player_uuid");
--> statement-breakpoint
CREATE INDEX "idx_server_chunk_party" ON "server_chunk" USING btree ("party_id");
