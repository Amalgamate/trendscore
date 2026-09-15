-- Allow one assessment cycle per week rather than one per term/test type.
-- Existing tests become Week 1, preserving all historical assessment data.
ALTER TABLE "summative_tests"
  ADD COLUMN IF NOT EXISTS "weekNumber" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "summative_tests_series_unique_key";

CREATE UNIQUE INDEX IF NOT EXISTS "summative_tests_series_unique_key"
  ON "summative_tests"("grade", "learningArea", "term", "academicYear", "testType", "weekNumber", "title");
