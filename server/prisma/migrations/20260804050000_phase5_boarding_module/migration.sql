-- Phase 5 — Boarding Module
-- Creates all 9 boarding tables: dormitories, beds, assignments,
-- house masters, exeat requests, roll calls, roll call entries,
-- dining attendance, prep attendance.
-- Additive only — no existing tables modified.

-- ── dormitories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dormitories" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"   TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "gender"      TEXT         NOT NULL,
  "capacity"    INTEGER      NOT NULL DEFAULT 0,
  "block"       TEXT,
  "notes"       TEXT,
  "active"      BOOLEAN      NOT NULL DEFAULT TRUE,
  "archived"    BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dormitories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dormitories_school_name_unique" UNIQUE ("school_id", "name")
);
CREATE INDEX IF NOT EXISTS "dormitories_school_active_idx" ON "dormitories"("school_id", "active");

-- ── dormitory_beds ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dormitory_beds" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "dormitory_id"  TEXT         NOT NULL,
  "bed_number"    TEXT         NOT NULL,
  "status"        TEXT         NOT NULL DEFAULT 'VACANT',
  "notes"         TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dormitory_beds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dormitory_beds_dorm_number_unique" UNIQUE ("dormitory_id", "bed_number"),
  CONSTRAINT "dormitory_beds_dormitory_fk"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "dormitory_beds_dorm_status_idx" ON "dormitory_beds"("dormitory_id", "status");

-- ── dormitory_assignments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dormitory_assignments" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "dormitory_id"   TEXT         NOT NULL,
  "bed_id"         TEXT,
  "learner_id"     TEXT         NOT NULL,
  "academic_year"  INTEGER      NOT NULL,
  "from_date"      DATE         NOT NULL,
  "to_date"        DATE,
  "active"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "archived"       BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dormitory_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dormitory_assignments_dormitory_fk"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id"),
  CONSTRAINT "dormitory_assignments_bed_fk"
    FOREIGN KEY ("bed_id") REFERENCES "dormitory_beds"("id")
);
CREATE INDEX IF NOT EXISTS "dormitory_assignments_learner_idx" ON "dormitory_assignments"("learner_id", "active");
CREATE INDEX IF NOT EXISTS "dormitory_assignments_dorm_idx"    ON "dormitory_assignments"("dormitory_id", "active");

-- ── house_master_assignments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "house_master_assignments" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "dormitory_id" TEXT         NOT NULL,
  "user_id"      TEXT         NOT NULL,
  "role"         TEXT         NOT NULL DEFAULT 'DUTY',
  "active"       BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "house_master_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "house_master_assignments_dormitory_fk"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id")
);
CREATE INDEX IF NOT EXISTS "house_master_assignments_dorm_idx" ON "house_master_assignments"("dormitory_id", "active");
CREATE INDEX IF NOT EXISTS "house_master_assignments_user_idx" ON "house_master_assignments"("user_id", "active");

-- ── exeat_requests ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exeat_requests" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"        TEXT         NOT NULL,
  "learner_id"       TEXT         NOT NULL,
  "requested_by"     TEXT         NOT NULL,
  "exeat_type"       TEXT         NOT NULL DEFAULT 'WEEKEND',
  "departure_date"   DATE         NOT NULL,
  "return_date"      DATE         NOT NULL,
  "reason"           TEXT         NOT NULL,
  "parent_phone"     TEXT,
  "status"           TEXT         NOT NULL DEFAULT 'PENDING',
  "approved_by"      TEXT,
  "approved_at"      TIMESTAMP(3),
  "denial_reason"    TEXT,
  "departed_at"      TIMESTAMP(3),
  "returned_at"      TIMESTAMP(3),
  "overdue_notified" BOOLEAN      NOT NULL DEFAULT FALSE,
  "archived"         BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exeat_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "exeat_requests_learner_idx" ON "exeat_requests"("learner_id", "departure_date" DESC);
CREATE INDEX IF NOT EXISTS "exeat_requests_school_idx"  ON "exeat_requests"("school_id", "status", "return_date");

-- ── dorm_roll_calls ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dorm_roll_calls" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"     TEXT         NOT NULL,
  "dormitory_id"  TEXT         NOT NULL,
  "date"          DATE         NOT NULL,
  "session"       TEXT         NOT NULL,
  "conducted_by"  TEXT         NOT NULL,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"  TIMESTAMP(3),
  "status"        TEXT         NOT NULL DEFAULT 'IN_PROGRESS',
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_roll_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dorm_roll_calls_unique" UNIQUE ("dormitory_id", "date", "session"),
  CONSTRAINT "dorm_roll_calls_dormitory_fk"
    FOREIGN KEY ("dormitory_id") REFERENCES "dormitories"("id")
);
CREATE INDEX IF NOT EXISTS "dorm_roll_calls_school_date_idx" ON "dorm_roll_calls"("school_id", "date" DESC);

-- ── dorm_roll_call_entries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dorm_roll_call_entries" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "roll_call_id"  TEXT         NOT NULL,
  "learner_id"    TEXT         NOT NULL,
  "status"        TEXT         NOT NULL DEFAULT 'PRESENT',
  "remarks"       TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dorm_roll_call_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dorm_roll_call_entries_unique" UNIQUE ("roll_call_id", "learner_id"),
  CONSTRAINT "dorm_roll_call_entries_roll_call_fk"
    FOREIGN KEY ("roll_call_id") REFERENCES "dorm_roll_calls"("id") ON DELETE CASCADE
);

-- ── dining_attendance ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dining_attendance" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"   TEXT         NOT NULL,
  "learner_id"  TEXT         NOT NULL,
  "date"        DATE         NOT NULL,
  "session"     TEXT         NOT NULL,
  "present"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "recorded_by" TEXT         NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dining_attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dining_attendance_unique" UNIQUE ("learner_id", "date", "session")
);
CREATE INDEX IF NOT EXISTS "dining_attendance_school_idx" ON "dining_attendance"("school_id", "date", "session");

-- ── prep_attendance ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prep_attendance" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "school_id"   TEXT         NOT NULL,
  "learner_id"  TEXT         NOT NULL,
  "date"        DATE         NOT NULL,
  "session"     TEXT         NOT NULL,
  "present"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "remarks"     TEXT,
  "recorded_by" TEXT         NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prep_attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prep_attendance_unique" UNIQUE ("learner_id", "date", "session")
);
CREATE INDEX IF NOT EXISTS "prep_attendance_school_idx" ON "prep_attendance"("school_id", "date");
