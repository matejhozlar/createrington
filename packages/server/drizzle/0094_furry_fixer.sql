CREATE TABLE "server_party_claim" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"dimension" varchar(255) NOT NULL,
	"chunk_x" integer NOT NULL,
	"chunk_z" integer NOT NULL,
	"owner_uuid" uuid NOT NULL,
	"forceloaded" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_party_claim_sync" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"hash" varchar(64) NOT NULL,
	"chunk_count" integer NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_party_claim" ADD CONSTRAINT "server_party_claim_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_party_claim_sync" ADD CONSTRAINT "server_party_claim_sync_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_party_claim_unique" ON "server_party_claim" USING btree ("server_id","dimension","chunk_x","chunk_z");--> statement-breakpoint
CREATE INDEX "idx_server_party_claim_owner" ON "server_party_claim" USING btree ("server_id","owner_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_party_claim_sync_server" ON "server_party_claim_sync" USING btree ("server_id");