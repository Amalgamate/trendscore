-- The boarding-event table on some live schools predates the mapped transport
-- schema and has Prisma's original camelCase column names. Normalize those
-- names in place; never drop a column or discard a row. If both variants exist,
-- copy values into the mapped column and retain the legacy column.
DO $$
DECLARE
  mapping RECORD;
  has_legacy BOOLEAN;
  has_mapped BOOLEAN;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('tripId', 'trip_id', 'TEXT'),
      ('learnerId', 'learner_id', 'TEXT'),
      ('eventType', 'event_type', 'TEXT'),
      ('recordedAt', 'recorded_at', 'TIMESTAMP(3) WITHOUT TIME ZONE'),
      ('recordedBy', 'recorded_by', 'TEXT'),
      ('deviceId', 'device_id', 'TEXT'),
      ('createdAt', 'created_at', 'TIMESTAMP(3) WITHOUT TIME ZONE')
    ) AS columns(legacy_name, mapped_name, column_type)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transport_boarding_events'
        AND column_name = mapping.legacy_name
    ) INTO has_legacy;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transport_boarding_events'
        AND column_name = mapping.mapped_name
    ) INTO has_mapped;

    IF has_legacy AND NOT has_mapped THEN
      EXECUTE format(
        'ALTER TABLE public.transport_boarding_events RENAME COLUMN %I TO %I',
        mapping.legacy_name, mapping.mapped_name
      );
      has_mapped := TRUE;
    ELSIF has_legacy AND has_mapped THEN
      EXECUTE format(
        'UPDATE public.transport_boarding_events SET %I = COALESCE(%I, %I) WHERE %I IS NULL',
        mapping.mapped_name, mapping.mapped_name, mapping.legacy_name, mapping.mapped_name
      );
    END IF;

    IF NOT has_mapped THEN
      EXECUTE format(
        'ALTER TABLE public.transport_boarding_events ADD COLUMN %I %s',
        mapping.mapped_name, mapping.column_type
      );
    END IF;
  END LOOP;
END $$;

-- Stop safely and leave all school data untouched if legacy required values
-- are incomplete.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transport_boarding_events
    WHERE trip_id IS NULL OR learner_id IS NULL OR event_type IS NULL
      OR recorded_at IS NULL OR created_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot normalize transport_boarding_events: required event values contain NULLs';
  END IF;
END $$;

ALTER TABLE public.transport_boarding_events
  ALTER COLUMN trip_id SET NOT NULL,
  ALTER COLUMN learner_id SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN recorded_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN recorded_at SET NOT NULL,
  ALTER COLUMN method SET DEFAULT 'MANUAL',
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
DECLARE
  trip_column SMALLINT;
BEGIN
  SELECT attnum INTO trip_column
  FROM pg_attribute
  WHERE attrelid = 'public.transport_boarding_events'::regclass
    AND attname = 'trip_id' AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transport_boarding_events'::regclass
      AND contype = 'f' AND conkey = ARRAY[trip_column]
      AND confrelid = 'public.transport_trips'::regclass
  ) THEN
    ALTER TABLE public.transport_boarding_events
      ADD CONSTRAINT transport_boarding_events_trip_id_fkey
      FOREIGN KEY (trip_id) REFERENCES public.transport_trips(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS transport_boarding_events_trip_idx
  ON public.transport_boarding_events (trip_id);
CREATE INDEX IF NOT EXISTS transport_boarding_events_learner_idx
  ON public.transport_boarding_events (learner_id, recorded_at DESC);