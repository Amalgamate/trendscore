-- Add explicit CBE/KJSEA result fields and administrative status-code support.
-- A result row can now be either performance-bearing (score + grade code) or
-- administrative (status code only).

ALTER TABLE "summative_results"
  ALTER COLUMN "marksObtained" DROP NOT NULL,
  ALTER COLUMN "percentage" DROP NOT NULL,
  ALTER COLUMN "grade" DROP NOT NULL,
  ALTER COLUMN "status" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "rawScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rubricRating" TEXT,
  ADD COLUMN IF NOT EXISTS "gradeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "achievementLevel" INTEGER,
  ADD COLUMN IF NOT EXISTS "competencyBand" TEXT,
  ADD COLUMN IF NOT EXISTS "gradeDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "assessmentStatusCode" TEXT,
  ADD COLUMN IF NOT EXISTS "moderationComment" TEXT;

ALTER TABLE "formative_assessments"
  ADD COLUMN IF NOT EXISTS "gradeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "achievementLevel" INTEGER,
  ADD COLUMN IF NOT EXISTS "competencyBand" TEXT,
  ADD COLUMN IF NOT EXISTS "gradeDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "assessmentStatusCode" TEXT;

UPDATE "summative_results"
SET
  "rawScore" = COALESCE("rawScore", "marksObtained"::double precision),
  "gradeCode" = COALESCE(
    "gradeCode",
    CASE
      WHEN "cbcGrade" IN ('EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2') THEN "cbcGrade"
      WHEN "grade" IN ('EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2') THEN "grade"
      ELSE NULL
    END
  ),
  "rubricRating" = COALESCE(
    "rubricRating",
    CASE
      WHEN "cbcGrade" IN ('EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2') THEN "cbcGrade"
      WHEN "grade" IN ('EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2') THEN "grade"
      ELSE NULL
    END
  )
WHERE "assessmentStatusCode" IS NULL;

UPDATE "summative_results"
SET
  "achievementLevel" = CASE "gradeCode"
    WHEN 'EE1' THEN 8
    WHEN 'EE2' THEN 7
    WHEN 'ME1' THEN 6
    WHEN 'ME2' THEN 5
    WHEN 'AE1' THEN 4
    WHEN 'AE2' THEN 3
    WHEN 'BE1' THEN 2
    WHEN 'BE2' THEN 1
    ELSE "achievementLevel"
  END,
  "competencyBand" = CASE
    WHEN "gradeCode" LIKE 'EE%' THEN 'EE'
    WHEN "gradeCode" LIKE 'ME%' THEN 'ME'
    WHEN "gradeCode" LIKE 'AE%' THEN 'AE'
    WHEN "gradeCode" LIKE 'BE%' THEN 'BE'
    ELSE "competencyBand"
  END,
  "gradeDescription" = CASE "gradeCode"
    WHEN 'EE1' THEN 'Exceeding Expectations Level 1'
    WHEN 'EE2' THEN 'Exceeding Expectations Level 2'
    WHEN 'ME1' THEN 'Meeting Expectations Level 1'
    WHEN 'ME2' THEN 'Meeting Expectations Level 2'
    WHEN 'AE1' THEN 'Approaching Expectations Level 1'
    WHEN 'AE2' THEN 'Approaching Expectations Level 2'
    WHEN 'BE1' THEN 'Below Expectations Level 1'
    WHEN 'BE2' THEN 'Below Expectations Level 2'
    ELSE "gradeDescription"
  END
WHERE "gradeCode" IS NOT NULL;

ALTER TABLE "summative_results"
  DROP CONSTRAINT IF EXISTS "summative_results_cbe_grade_code_check",
  ADD CONSTRAINT "summative_results_cbe_grade_code_check"
    CHECK ("gradeCode" IS NULL OR "gradeCode" IN ('EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2'));

ALTER TABLE "summative_results"
  DROP CONSTRAINT IF EXISTS "summative_results_cbe_status_code_check",
  ADD CONSTRAINT "summative_results_cbe_status_code_check"
    CHECK ("assessmentStatusCode" IS NULL OR "assessmentStatusCode" IN ('X','Y','Z','EX','TR','WD'));

ALTER TABLE "summative_results"
  DROP CONSTRAINT IF EXISTS "summative_results_score_or_status_check",
  ADD CONSTRAINT "summative_results_score_or_status_check"
    CHECK (
      ("assessmentStatusCode" IS NULL AND "marksObtained" IS NOT NULL AND "gradeCode" IS NOT NULL)
      OR
      ("assessmentStatusCode" IS NOT NULL AND "marksObtained" IS NULL AND "gradeCode" IS NULL)
    );

ALTER TABLE "formative_assessments"
  DROP CONSTRAINT IF EXISTS "formative_assessments_cbe_grade_code_check",
  ADD CONSTRAINT "formative_assessments_cbe_grade_code_check"
    CHECK ("gradeCode" IS NULL OR "gradeCode" IN ('EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2'));

ALTER TABLE "formative_assessments"
  DROP CONSTRAINT IF EXISTS "formative_assessments_cbe_status_code_check",
  ADD CONSTRAINT "formative_assessments_cbe_status_code_check"
    CHECK ("assessmentStatusCode" IS NULL OR "assessmentStatusCode" IN ('X','Y','Z','EX','TR','WD'));

CREATE INDEX IF NOT EXISTS "summative_results_assessmentStatusCode_idx"
  ON "summative_results" ("assessmentStatusCode");

CREATE INDEX IF NOT EXISTS "summative_results_achievementLevel_idx"
  ON "summative_results" ("achievementLevel");
