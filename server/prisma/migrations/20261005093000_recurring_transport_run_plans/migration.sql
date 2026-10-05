-- Per-run vehicle substitutions for breakdowns and temporary changes.
-- Additive only: existing routes, trips, boarding events, and assignments remain.

ALTER TABLE "transport_trips"
  ADD COLUMN IF NOT EXISTS "vehicle_id" TEXT;

CREATE INDEX IF NOT EXISTS "transport_trips_vehicle_date_idx"
  ON "transport_trips"("vehicle_id", "date");

DO $$ BEGIN
  ALTER TABLE "transport_trips"
    ADD CONSTRAINT "transport_trips_vehicle_fk"
    FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

