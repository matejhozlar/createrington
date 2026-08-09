-- Membership means published now. Rows that never went live were records of
-- intent, which workshop_mod.status already carries, and dependency rows that
-- were auto-added on promotion have nothing to represent until a publish
-- actually ships them.
DELETE FROM "modpack_mod"
WHERE "live_at" IS NULL
  AND "dropped_from_manifest_at" IS NULL;
