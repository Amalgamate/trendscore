-- The IBSE database has a pre-existing Prisma-created transport_trips table
-- whose camelCase columns predate the mapped snake_case schema. Rename in place
-- so every value and relation is retained; never drop or recreate the table.
DO $$
DECLARE
  mapping RECORD;
BEGIN
  IF to_regclass('public.transport_trips') IS NULL THEN
    RAISE EXCEPTION 'transport_trips is missing; refusing to synthesize a replacement table';
  END IF;

  FOR mapping IN
    SELECT * FROM (VALUES
      ('schoolId', 'school_id'),
      ('routeId', 'route_id'),
      ('departedAt', 'departed_at'),
      ('arrivedAt', 'arrived_at'),
      ('driverUserId', 'driver_user_id'),
      ('createdAt', 'created_at'),
      ('updatedAt', 'updated_at')
    ) AS column_map(old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transport_trips'
        AND column_name = mapping.old_name
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transport_trips'
        AND column_name = mapping.new_name
    ) THEN
      EXECUTE format('ALTER TABLE public.transport_trips RENAME COLUMN %I TO %I', mapping.old_name, mapping.new_name);
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT required.column_name
    FROM (VALUES ('school_id'), ('route_id'), ('departed_at'), ('arrived_at'), ('driver_user_id'), ('created_at'), ('updated_at')) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns actual
      WHERE actual.table_schema = 'public' AND actual.table_name = 'transport_trips'
        AND actual.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'transport_trips is missing required mapped columns after in-place normalization';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "transport_trips_route_date_idx"
  ON "transport_trips"("route_id", "date");
CREATE INDEX IF NOT EXISTS "transport_trips_school_date_idx"
  ON "transport_trips"("school_id", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_trips_route_date_direction_unique"
  ON "transport_trips"("route_id", "date", "direction");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_trips_route_fk') THEN
    ALTER TABLE "transport_trips"
      ADD CONSTRAINT "transport_trips_route_fk"
      FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;