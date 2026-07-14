-- Adopt or create structured senior-school search criteria per learner.
-- This migration is intentionally safe when the original SQL was already run
-- manually before it became part of Prisma's timestamped migration history.

CREATE TABLE IF NOT EXISTS "learner_school_search_criteria" (
  "id"                 TEXT NOT NULL,
  "learnerId"          TEXT NOT NULL,
  "budgetBand"         TEXT,
  "boardingPreference" TEXT,
  "preferredCounties"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "faithPreference"    TEXT,
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_school_search_criteria_pkey" PRIMARY KEY ("id")
);

-- The manually applied version used a database UUID default while Prisma's
-- uuid() generates IDs in the client. Existing IDs are retained.
ALTER TABLE "learner_school_search_criteria"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS
  "learner_school_search_criteria_learnerId_key"
  ON "learner_school_search_criteria"("learnerId");

DO $$
DECLARE
  orphan_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "learner_school_search_criteria" criteria
  LEFT JOIN "learners" learner ON learner."id" = criteria."learnerId"
  WHERE learner."id" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Search-criteria migration blocked: % row(s) reference missing learners',
      orphan_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learner_school_search_criteria_learnerId_fkey'
  ) THEN
    ALTER TABLE "learner_school_search_criteria"
      ADD CONSTRAINT "learner_school_search_criteria_learnerId_fkey"
      FOREIGN KEY ("learnerId") REFERENCES "learners"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

