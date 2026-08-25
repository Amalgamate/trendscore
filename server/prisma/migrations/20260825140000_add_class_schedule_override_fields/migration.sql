-- Migration: add_class_schedule_override_fields
-- Adds manual override tracking to ClassSchedule so quick one-off changes
-- made by admins/head-teachers after a timetable is published are flagged
-- and visible in the UI (amber indicator) and accounted for in the publish
-- confirmation flow.

ALTER TABLE "class_schedules"
  ADD COLUMN IF NOT EXISTS "isOverride"    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "overrideNote"  TEXT,
  ADD COLUMN IF NOT EXISTS "overriddenAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "overriddenBy"  TEXT;

-- Index for override queries (e.g. counting overrides before publish)
CREATE INDEX IF NOT EXISTS "class_schedules_isOverride_idx"
  ON "class_schedules" ("isOverride");
