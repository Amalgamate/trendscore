-- Phase 0 Sprint 0.1 — Biometric Security & Schema Foundations
-- Adds encryption metadata to biometric_credentials,
-- schoolId to biometric tables, source+updatedAt to attendances.
-- SAFE: purely additive — no drops, no renames, no data changes.

-- ── biometric_credentials: add encryption metadata columns ──────────────────
ALTER TABLE "biometric_credentials"
  ADD COLUMN IF NOT EXISTS "key_version"   INTEGER   NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "encrypted_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "enrolled_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "status"        TEXT         NOT NULL DEFAULT 'ACTIVE';

-- Migrate template column from TEXT to BYTEA
-- NOTE: existing rows will have their text bytes stored as bytea.
-- Run server/src/scripts/migrate-biometric-templates.ts AFTER this migration
-- to re-encrypt any plaintext templates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'biometric_credentials' AND column_name = 'template' AND data_type = 'text'
  ) THEN
    ALTER TABLE "biometric_credentials" ALTER COLUMN "template" TYPE BYTEA USING "template"::BYTEA;
  END IF;
END $$;

-- ── biometric_devices: add schoolId and hardware metadata ───────────────────
ALTER TABLE "biometric_devices"
  ADD COLUMN IF NOT EXISTS "school_id"         TEXT,
  ADD COLUMN IF NOT EXISTS "serial_number"      TEXT,
  ADD COLUMN IF NOT EXISTS "firmware_version"   TEXT,
  ADD COLUMN IF NOT EXISTS "sync_mode"          TEXT NOT NULL DEFAULT 'PUSH';

CREATE INDEX IF NOT EXISTS "biometric_devices_school_id_idx"
  ON "biometric_devices"("school_id");

-- ── biometric_logs: add schoolId and retry support ──────────────────────────
ALTER TABLE "biometric_logs"
  ADD COLUMN IF NOT EXISTS "school_id"    TEXT,
  ADD COLUMN IF NOT EXISTS "retry_count"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retry_at"     TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "biometric_logs_school_id_idx"
  ON "biometric_logs"("school_id");

-- ── attendances: add source and updatedAt ────────────────────────────────────
ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "source"     TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Compound index for daily class register queries
CREATE INDEX IF NOT EXISTS "attendances_class_id_date_idx"
  ON "attendances"("classId", "date");

-- Soft-FK index for markedBy lookups (actual FK already exists via relation)
CREATE INDEX IF NOT EXISTS "attendances_marked_by_idx"
  ON "attendances"("markedBy");
