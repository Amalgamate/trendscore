-- Phase 2 — Transport Trips & Boarding Events
-- Adds daily trip concept and per-learner boarding events to transport module.
-- Also adds schoolId to transport_vehicles and transport_routes.
-- Additive only — no existing columns dropped or renamed.

-- ── transport_vehicles: add schoolId ─────────────────────────────────────────
ALTER TABLE "transport_vehicles"
  ADD COLUMN IF NOT EXISTS "school_id" TEXT;

CREATE INDEX IF NOT EXISTS "transport_vehicles_school_id_idx"
  ON "transport_vehicles"("school_id");

-- ── transport_routes: add schoolId ───────────────────────────────────────────
ALTER TABLE "transport_routes"
  ADD COLUMN IF NOT EXISTS "school_id" TEXT;

CREATE INDEX IF NOT EXISTS "transport_routes_school_id_idx"
  ON "transport_routes"("school_id");

-- ── transport_trips ───────────────────────────────────────────────────────────
-- One trip = one daily run of a route in one direction.
CREATE TABLE IF NOT EXISTS "transport_trips" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"      TEXT         NOT NULL,
  "route_id"       TEXT         NOT NULL,
  "date"           DATE         NOT NULL,
  "direction"      TEXT         NOT NULL,   -- OUTBOUND | INBOUND
  "departed_at"    TIMESTAMP(3),
  "arrived_at"     TIMESTAMP(3),
  "driver_user_id" TEXT,
  "status"         TEXT         NOT NULL DEFAULT 'SCHEDULED',
  "notes"          TEXT,
  "archived"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_trips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_trips_route_fk"
    FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- One trip per route per date per direction
  CONSTRAINT "transport_trips_route_date_direction_unique"
    UNIQUE ("route_id", "date", "direction")
);

CREATE INDEX IF NOT EXISTS "transport_trips_route_date_idx"
  ON "transport_trips"("route_id", "date" DESC);

CREATE INDEX IF NOT EXISTS "transport_trips_school_date_idx"
  ON "transport_trips"("school_id", "date" DESC);

-- ── transport_boarding_events ─────────────────────────────────────────────────
-- One row per learner per boarding/alighting event per trip.
CREATE TABLE IF NOT EXISTS "transport_boarding_events" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "trip_id"     TEXT         NOT NULL,
  "learner_id"  TEXT         NOT NULL,
  "event_type"  TEXT         NOT NULL,   -- BOARDED | ALIGHTED
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"      TEXT         NOT NULL DEFAULT 'MANUAL',  -- MANUAL | SCAN | CONFIRMED
  "recorded_by" TEXT,
  "device_id"   TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_boarding_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_boarding_events_trip_fk"
    FOREIGN KEY ("trip_id") REFERENCES "transport_trips"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "transport_boarding_events_trip_idx"
  ON "transport_boarding_events"("trip_id");

CREATE INDEX IF NOT EXISTS "transport_boarding_events_learner_idx"
  ON "transport_boarding_events"("learner_id", "recorded_at" DESC);
