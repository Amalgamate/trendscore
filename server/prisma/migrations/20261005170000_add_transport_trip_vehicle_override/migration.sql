-- Per-run vehicle override for driver run changes and vehicle breakdowns.
-- Additive and nullable: existing trip assignments and all school data remain intact.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_trips'
      AND column_name = 'vehicleId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_trips'
      AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE "transport_trips" RENAME COLUMN "vehicleId" TO "vehicle_id";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_trips'
      AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE "transport_trips" ADD COLUMN "vehicle_id" TEXT;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_trips'
      AND column_name = 'vehicleId'
  ) THEN
    -- If both legacy and mapped columns exist, preserve legacy references in the mapped column.
    EXECUTE 'UPDATE "transport_trips" SET "vehicle_id" = COALESCE("vehicle_id", "vehicleId")';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transport_trips_vehicle_id_fkey'
      AND conrelid = 'public.transport_trips'::regclass
  ) THEN
    ALTER TABLE "transport_trips"
      ADD CONSTRAINT "transport_trips_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "transport_trips_vehicle_id_date_idx"
  ON "transport_trips"("vehicle_id", "date");
