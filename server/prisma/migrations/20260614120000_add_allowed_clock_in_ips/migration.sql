-- Migration: Add allowedClockInIps to schools table
-- Replaces GPS geofence enforcement with IP-based (school Wi-Fi) clock-in restriction.
-- The geofence columns (latitude, longitude, geofenceRadiusMeters, geofenceEnforcementMode)
-- are preserved for future re-activation but geofenceEnforcementMode default is changed to OFF.

ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "allowedClockInIps" TEXT;

-- Change default enforcement mode to OFF (geofence disabled while IP-based check is the primary mechanism)
ALTER TABLE "schools"
  ALTER COLUMN "geofenceEnforcementMode" SET DEFAULT 'OFF';

-- Update existing rows that have STRICT as default to OFF
-- (only if they have never been explicitly set to something else — i.e. they equal the old default)
UPDATE "schools"
  SET "geofenceEnforcementMode" = 'OFF'
  WHERE "geofenceEnforcementMode" = 'STRICT';
