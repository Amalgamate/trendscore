-- Add classId (optional) to subject_assignments so allocations can be
-- scoped to a specific class/stream rather than just a grade.
-- Existing rows keep grade-level assignments (classId stays NULL).

ALTER TABLE "subject_assignments" ADD COLUMN IF NOT EXISTS "classId" TEXT;

-- Add a foreign-key reference to classes (idempotent)
DO $$ BEGIN
  ALTER TABLE "subject_assignments"
    ADD CONSTRAINT "subject_assignments_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for fast lookup by class (idempotent)
CREATE INDEX IF NOT EXISTS "subject_assignments_classId_idx" ON "subject_assignments"("classId");

-- Drop the old grade-level unique constraint (idempotent)
ALTER TABLE "subject_assignments"
  DROP CONSTRAINT IF EXISTS "subject_assignments_teacherId_learningAreaId_grade_key";

-- Unique per teacher + learning area + class (when classId is set)
CREATE UNIQUE INDEX IF NOT EXISTS "subject_assignments_teacher_area_class_key"
  ON "subject_assignments"("teacherId", "learningAreaId", "classId")
  WHERE "classId" IS NOT NULL;

-- Unique per teacher + learning area + grade (legacy rows without classId)
CREATE UNIQUE INDEX IF NOT EXISTS "subject_assignments_teacher_area_grade_key"
  ON "subject_assignments"("teacherId", "learningAreaId", "grade")
  WHERE "classId" IS NULL;
