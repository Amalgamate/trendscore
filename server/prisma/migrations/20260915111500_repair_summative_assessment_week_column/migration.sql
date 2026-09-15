-- Repair installations that baselined the Week-cycle migration without
-- executing its schema changes. Safe to run whether the original migration
-- completed or not.
ALTER TABLE "summative_tests"
  ADD COLUMN IF NOT EXISTS "weekNumber" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "summative_tests_series_unique_key";

CREATE UNIQUE INDEX IF NOT EXISTS "summative_tests_series_unique_key"
  ON "summative_tests"("grade", "learningArea", "term", "academicYear", "testType", "weekNumber", "title");
