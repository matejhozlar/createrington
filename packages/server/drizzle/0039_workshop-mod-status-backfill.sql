-- Mods approved under the old flow were added to the pack immediately; carry
-- them into the equivalent new state so their pack rows stay legitimate. Rows
-- whose pack row is already live land in in_pack, which keeps the first
-- reconcile after deploy from announcing them as freshly shipped. Approved
-- mods with no pack row stay approved, meaning "awaiting testing".
UPDATE "workshop_mod" wm
SET "status" = 'in_pack'
WHERE wm."status" = 'approved'
  AND EXISTS (
    SELECT 1
    FROM "modpack_mod" mm
    WHERE mm."workshop_mod_id" = wm."id"
      AND mm."live_at" IS NOT NULL
  );--> statement-breakpoint
UPDATE "workshop_mod" wm
SET "status" = 'next_update'
WHERE wm."status" = 'approved'
  AND EXISTS (
    SELECT 1
    FROM "modpack_mod" mm
    WHERE mm."workshop_mod_id" = wm."id"
      AND mm."live_at" IS NULL
  );
