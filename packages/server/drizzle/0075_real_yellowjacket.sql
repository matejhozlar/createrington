CREATE TABLE "player_minecraft_stat_key" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"item" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_minecraft_stat_total" (
	"stat_key_id" integer NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"value" bigint NOT NULL,
	CONSTRAINT "player_minecraft_stat_total_stat_key_id_minecraft_uuid_pk" PRIMARY KEY("stat_key_id","minecraft_uuid"),
	CONSTRAINT "chk_player_minecraft_stat_total_positive" CHECK (value > 0)
);
--> statement-breakpoint
ALTER TABLE "player_minecraft_stat_total" ADD CONSTRAINT "player_minecraft_stat_total_stat_key_id_player_minecraft_stat_key_id_fk" FOREIGN KEY ("stat_key_id") REFERENCES "public"."player_minecraft_stat_key"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "player_minecraft_stat_total" ADD CONSTRAINT "player_minecraft_stat_total_minecraft_uuid_player_minecraft_uuid_fk" FOREIGN KEY ("minecraft_uuid") REFERENCES "public"."player"("minecraft_uuid") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_player_minecraft_stat_key" ON "player_minecraft_stat_key" USING btree ("category","item");--> statement-breakpoint
CREATE INDEX "idx_player_minecraft_stat_total_ranking" ON "player_minecraft_stat_total" USING btree ("stat_key_id","value" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_player_minecraft_stat_total_player" ON "player_minecraft_stat_total" USING btree ("minecraft_uuid");--> statement-breakpoint
INSERT INTO "player_minecraft_stat_key" ("category", "item")
SELECT DISTINCT cat.key, item.key
FROM "player_minecraft_stats" s
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.stats) = 'object' THEN s.stats ELSE '{}'::jsonb END) AS cat(key, value)
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(cat.value) = 'object' THEN cat.value ELSE '{}'::jsonb END) AS item(key, value)
WHERE jsonb_typeof(item.value) = 'number'
ON CONFLICT ("category", "item") DO NOTHING;--> statement-breakpoint
INSERT INTO "player_minecraft_stat_total" ("stat_key_id", "minecraft_uuid", "value")
SELECT k.id, s.minecraft_uuid, GREATEST(LEAST(SUM(item.value::numeric), 9223372036854775807), 0)::bigint
FROM "player_minecraft_stats" s
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.stats) = 'object' THEN s.stats ELSE '{}'::jsonb END) AS cat(key, value)
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(cat.value) = 'object' THEN cat.value ELSE '{}'::jsonb END) AS item(key, value)
JOIN "player_minecraft_stat_key" k ON k.category = cat.key AND k.item = item.key
WHERE jsonb_typeof(item.value) = 'number'
GROUP BY k.id, s.minecraft_uuid
HAVING GREATEST(LEAST(SUM(item.value::numeric), 9223372036854775807), 0)::bigint > 0;
