-- Repair additive attendance-lock columns in installations whose migration
-- history was baselined before these fields were introduced.  Both changes are
-- backwards-compatible and preserve all existing assignments and classes.

ALTER TABLE "classes"
  ADD COLUMN IF NOT EXISTS "attendanceLockExempt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subject_assignments"
  ADD COLUMN IF NOT EXISTS "attendanceLockExempt" BOOLEAN NOT NULL DEFAULT false;
