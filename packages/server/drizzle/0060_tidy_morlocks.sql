UPDATE "server_maintenance_schedule" s
SET "status" = 'cancelled', "updated_at" = now()
WHERE s."status" IN ('scheduled', 'active')
  AND s."id" <> (
    SELECT MAX(o."id") FROM "server_maintenance_schedule" o
    WHERE o."server_id" = s."server_id" AND o."status" IN ('scheduled', 'active')
  );--> statement-breakpoint
CREATE UNIQUE INDEX "idx_server_maintenance_schedule_open" ON "server_maintenance_schedule" USING btree ("server_id") WHERE "server_maintenance_schedule"."status" IN ('scheduled', 'active');
