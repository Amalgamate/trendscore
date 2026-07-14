-- Manual data-preserving rollback. The table remains because dropping it would
-- destroy family preference data.
ALTER TABLE "learner_school_search_criteria"
  DROP CONSTRAINT IF EXISTS "learner_school_search_criteria_learnerId_fkey";

ALTER TABLE "learner_school_search_criteria"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

