UPDATE "discord_auto_message" AS m
SET "sort_order" = r."position"
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "config_id" ORDER BY "sort_order", "id") - 1)::int AS "position"
  FROM "discord_auto_message"
) AS r
WHERE m."id" = r."id" AND m."sort_order" <> r."position";
