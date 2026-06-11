DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeofenceEnforcementMode') THEN
    CREATE TYPE "GeofenceEnforcementMode" AS ENUM ('STRICT', 'SOFT', 'OFF');
  END IF;
END $$;

ALTER TABLE "schools"
ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS "geofenceEnforcementMode" "GeofenceEnforcementMode" NOT NULL DEFAULT 'STRICT';
