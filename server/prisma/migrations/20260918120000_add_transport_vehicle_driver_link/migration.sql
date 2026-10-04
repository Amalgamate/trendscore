-- Durable driver identity for the driver app.
--
-- Vehicles previously stored the driver as free text (driver_name / driver_phone),
-- so a signed-in driver could not be matched to their vehicle. This adds an
-- optional FK to users.id and backfills it by matching driver_phone against the
-- users table.

ALTER TABLE "transport_vehicles" ADD COLUMN "driverId" TEXT;

CREATE UNIQUE INDEX "transport_vehicles_driverId_key"
  ON "transport_vehicles"("driverId");

CREATE INDEX "transport_vehicles_driverId_idx"
  ON "transport_vehicles"("driverId");

-- Backfill: match on phone, normalising separators, only for users holding the
-- DRIVER role. DISTINCT guards against a phone shared by two driver accounts —
-- without it this would raise a unique violation and abort the migration.
--
-- Phone is stored in several formats across the app (spaces, +254/0 prefixes),
-- so compare on digits only.
UPDATE "transport_vehicles" v
SET "driverId" = u."id"
FROM (
  SELECT DISTINCT ON ("phoneDigits")
         "id",
         regexp_replace("phone", '[^0-9]', '', 'g') AS "phoneDigits"
  FROM "users"
  WHERE "phone" IS NOT NULL
    AND trim("phone") <> ''
    AND (
      "role" = 'DRIVER'
      OR "roles" @> ARRAY['DRIVER']::"UserRole"[]
    )
) u
WHERE u."phoneDigits" = regexp_replace(v."driverPhone", '[^0-9]', '', 'g')
  AND v."driverPhone" IS NOT NULL
  AND trim(v."driverPhone") <> ''
  AND v."driverId" IS NULL;

-- Guard the FK. ON DELETE SET NULL keeps the vehicle intact (and its route
-- assignments) when a driver account is archived or removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transport_vehicles_driverId_fkey'
  ) THEN
    ALTER TABLE "transport_vehicles"
      ADD CONSTRAINT "transport_vehicles_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;