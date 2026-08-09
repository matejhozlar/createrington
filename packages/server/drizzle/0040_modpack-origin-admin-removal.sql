-- Admin adds go through the suggestion funnel now, so nothing writes a pack row
-- directly any more. Carry the rows the old path created into the equivalent
-- suggestion, credited to whoever added them, before the origin value goes away.
INSERT INTO "workshop_mod" (
  "workshop_id",
  "curseforge_project_id",
  "submitted_by",
  "status",
  "reviewed_by",
  "reviewed_at",
  "file_id",
  "file_name",
  "file_release_type",
  "created_at"
)
SELECT
  w."id",
  mm."curseforge_project_id",
  COALESCE(mm."added_by", w."created_by"),
  CASE
    WHEN mm."live_at" IS NOT NULL THEN 'in_pack'
    ELSE 'next_update'
  END::"public"."workshop_mod_status",
  COALESCE(mm."added_by", w."created_by"),
  mm."created_at",
  mm."file_id",
  mm."file_name",
  mm."file_release_type",
  mm."created_at"
FROM "modpack_mod" mm
JOIN LATERAL (
  SELECT w2."id", w2."created_by"
  FROM "workshop" w2
  WHERE w2."modpack_id" = mm."modpack_id"
  ORDER BY w2."created_at" DESC, w2."id" DESC
  LIMIT 1
) w ON TRUE
WHERE mm."origin" = 'admin'
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Link the row this migration just created. Preferring the newest non-rejected
-- suggestion matters when a sibling workshop on the same modpack already holds
-- one for the project: linking that older row would credit the wrong workshop
-- and leave reconcile driving status off a suggestion nobody promoted.
UPDATE "modpack_mod" mm
SET
  "origin" = 'suggestion',
  "added_by" = NULL,
  "workshop_mod_id" = (
    SELECT wm."id"
    FROM "workshop_mod" wm
    JOIN "workshop" w ON w."id" = wm."workshop_id"
    WHERE w."modpack_id" = mm."modpack_id"
      AND wm."curseforge_project_id" = mm."curseforge_project_id"
      AND wm."status" <> 'rejected'
    ORDER BY wm."id" DESC
    LIMIT 1
  )
WHERE mm."origin" = 'admin'
  AND EXISTS (
    SELECT 1
    FROM "workshop_mod" wm
    JOIN "workshop" w ON w."id" = wm."workshop_id"
    WHERE w."modpack_id" = mm."modpack_id"
      AND wm."curseforge_project_id" = mm."curseforge_project_id"
      AND wm."status" <> 'rejected'
  );--> statement-breakpoint
-- Anything left belongs to a modpack with no workshop, so it has nothing to be
-- credited to. It stays a member as an import rather than being deleted: if the
-- published pack still ships it, dropping the row would lose its live history.
UPDATE "modpack_mod" SET "origin" = 'import', "added_by" = NULL WHERE "origin" = 'admin';--> statement-breakpoint
ALTER TABLE "modpack_mod" ALTER COLUMN "origin" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."modpack_mod_origin";--> statement-breakpoint
CREATE TYPE "public"."modpack_mod_origin" AS ENUM('suggestion', 'dependency', 'import');--> statement-breakpoint
ALTER TABLE "modpack_mod" ALTER COLUMN "origin" SET DATA TYPE "public"."modpack_mod_origin" USING "origin"::"public"."modpack_mod_origin";
