-- Mods approved under the old flow were added to the pack immediately; carry
-- them into the equivalent new state so their pack rows stay legitimate.
UPDATE "workshop_mod" wm
SET "status" = 'next_update'
WHERE wm."status" = 'approved'
  AND EXISTS (
    SELECT 1
    FROM "modpack_mod" mm
    WHERE mm."workshop_mod_id" = wm."id"
  );
