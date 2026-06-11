DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeofenceEnforcementMode') THEN
    CREATE TYPE "GeofenceEnforcementMode" AS ENUM ('STRICT', 'SOFT', 'OFF');
  END IF;
END $$;

ALTER TABLE "schools"
ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "geofenceEnforcementMode" "GeofenceEnforcementMode" NOT NULL DEFAULT 'STRICT';

-- Update any existing rows that still have the initial 5m default to the practical 30m default.
-- Schools that an admin has explicitly configured to a value other than 5 are not affected.
UPDATE "schools" SET "geofenceRadiusMeters" = 30 WHERE "geofenceRadiusMeters" = 5;
