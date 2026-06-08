-- Relax the score-or-status constraint that blocked existing summative results.
-- The original constraint required gradeCode NOT NULL when marksObtained IS NOT NULL,
-- but existing records predate the gradeCode field and have gradeCode = NULL.
-- Validation is handled at the application layer instead.

ALTER TABLE "summative_results"
  DROP CONSTRAINT IF EXISTS "summative_results_score_or_status_check";

-- Also backfill gradeCode = NULL for any rows that are missing it
-- so future constraint additions don't break on old data.
-- Leave gradeCode NULL — application will display marks-based grade.

-- Keep the individual value-range constraints (they only fire when the column IS NOT NULL).
-- These are safe and correct.
