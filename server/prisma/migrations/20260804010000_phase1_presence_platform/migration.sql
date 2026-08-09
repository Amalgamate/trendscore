-- Phase 1 — Presence Platform Foundation
-- Creates the four presence platform tables.
-- Additive only — no existing tables modified.

-- ── presence_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "presence_events" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"        TEXT         NOT NULL,
  "person_id"        TEXT         NOT NULL,
  "person_type"      TEXT         NOT NULL,
  "event_type"       TEXT         NOT NULL,
  "context"          TEXT         NOT NULL,
  "timestamp"        TIMESTAMP(3) NOT NULL,
  "recorded_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by"      TEXT,
  "device_id"        TEXT,
  "location"         TEXT,
  "direction"        TEXT,
  "status"           TEXT         NOT NULL DEFAULT 'CONFIRMED',
  "source_module"    TEXT         NOT NULL,
  "source_record_id" TEXT,
  "metadata"         JSONB,
  "version"          INTEGER      NOT NULL DEFAULT 1,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "presence_events_pkey" PRIMARY KEY ("id")
);

-- Deduplication: one confirmed event per person+type+timestamp
CREATE UNIQUE INDEX IF NOT EXISTS "presence_events_dedup_idx"
  ON "presence_events"("person_id", "event_type", "timestamp")
  WHERE "status" = 'CONFIRMED';

CREATE INDEX IF NOT EXISTS "presence_events_person_ts_idx"
  ON "presence_events"("person_id", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS "presence_events_school_ts_idx"
  ON "presence_events"("school_id", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS "presence_events_event_type_ts_idx"
  ON "presence_events"("event_type", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS "presence_events_source_idx"
  ON "presence_events"("source_module", "source_record_id");

CREATE INDEX IF NOT EXISTS "presence_events_school_type_ts_idx"
  ON "presence_events"("school_id", "event_type", "timestamp" DESC);

-- ── presence_rules ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "presence_rules" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"  TEXT         NOT NULL,
  "rule_code"  TEXT         NOT NULL,
  "enabled"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "config"     JSONB        NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "presence_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "presence_rules_school_rule_unique" UNIQUE ("school_id", "rule_code")
);

-- ── presence_rule_violations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "presence_rule_violations" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"   TEXT         NOT NULL,
  "rule_id"     TEXT         NOT NULL,
  "person_id"   TEXT         NOT NULL,
  "person_type" TEXT         NOT NULL,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "resolution"  TEXT,
  "notified"    BOOLEAN      NOT NULL DEFAULT FALSE,
  "metadata"    JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "presence_rule_violations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "presence_rule_violations_rule_fk"
    FOREIGN KEY ("rule_id") REFERENCES "presence_rules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "presence_rule_violations_person_idx"
  ON "presence_rule_violations"("person_id", "detected_at" DESC);

CREATE INDEX IF NOT EXISTS "presence_rule_violations_school_idx"
  ON "presence_rule_violations"("school_id", "resolved_at");

-- ── presence_event_failures ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "presence_event_failures" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"        TEXT,
  "source_module"    TEXT         NOT NULL,
  "source_record_id" TEXT,
  "attempted_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_message"    TEXT,
  "payload"          JSONB,
  "retry_count"      INTEGER      NOT NULL DEFAULT 0,
  "resolved"         BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "presence_event_failures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "presence_event_failures_retry_idx"
  ON "presence_event_failures"("resolved", "retry_count");
