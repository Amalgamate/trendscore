-- Add the two additional CBC core competencies introduced in the assessment UI.
-- They remain nullable so historical records and older clients continue to work.
ALTER TABLE "core_competencies"
  ADD COLUMN "digitalLiteracy" "DetailedRubricRating",
  ADD COLUMN "digitalLiteracyComment" TEXT,
  ADD COLUMN "selfEfficacy" "DetailedRubricRating",
  ADD COLUMN "selfEfficacyComment" TEXT;
