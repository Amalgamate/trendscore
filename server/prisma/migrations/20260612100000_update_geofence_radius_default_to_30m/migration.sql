-- Update the column default so new schools get 30m instead of 5m.
ALTER TABLE "schools" ALTER COLUMN "geofenceRadiusMeters" SET DEFAULT 30;

-- Update every existing school that still has the original 5m default
-- so they benefit from the practical browser-GPS minimum without requiring
-- manual reconfiguration by each admin.
UPDATE "schools" SET "geofenceRadiusMeters" = 30 WHERE "geofenceRadiusMeters" = 5;
