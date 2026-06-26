-- Re-apply isParentVisible column that was missed during earlier migration.
-- The original 20260626090000 migration was recorded as applied but the
-- column was never materialized (likely events table was recreated after).

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "isParentVisible" BOOLEAN NOT NULL DEFAULT true;
