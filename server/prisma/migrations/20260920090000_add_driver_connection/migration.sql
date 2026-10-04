-- Driver app onboarding: per-school driver code + device approval.
--
-- A phone running the universal driver app has to discover which school's API to
-- talk to at runtime, because every school is its own stack with its own database.
-- The driver types a short CODE, never a URL: the origin is always rebuilt from
-- the server-owned deployment domain. driverCode is nullable so schools that never
-- onboard a driver app never appear in the public directory.
--
-- Device approval is required (owner decision, 2026-10-03). A guessable code alone
-- must not grant access to a real school's routes, vehicle and learner list, so a
-- phone records a request and an administrator approves it before sign-in.

ALTER TABLE "schools" ADD COLUMN "driverCode" TEXT;

CREATE UNIQUE INDEX "schools_driverCode_key" ON "schools"("driverCode");

CREATE TABLE IF NOT EXISTS "driver_devices" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"    TEXT        NOT NULL,
  -- Opaque, generated on the phone. NOT an IMEI or Android ID.
  "device_id"    TEXT        NOT NULL,
  "label"        TEXT,
  -- PENDING | APPROVED | REVOKED
  "status"       TEXT        NOT NULL DEFAULT 'PENDING',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at"  TIMESTAMP(3),
  "approved_by"  TEXT,
  "revoked_at"   TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "driver_devices_school_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- One row per phone per school: re-registering is idempotent, never a duplicate.
CREATE UNIQUE INDEX "driver_devices_school_id_device_id_key"
  ON "driver_devices"("school_id", "device_id");

-- The admin approval list queries by school and filters on status.
CREATE INDEX "driver_devices_school_id_status_idx"
  ON "driver_devices"("school_id", "status");