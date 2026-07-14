-- Pathway Planner Phase 0
--
-- Adopt the legacy learner_pathway_recommendations table without deleting its
-- rows. Older releases created this table at runtime with raw SQL and used a
-- UUID primary key. Prisma models String IDs as TEXT in this project, so the
-- existing UUID values are converted losslessly to their textual form.

CREATE TABLE IF NOT EXISTS "learner_pathway_recommendations" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "recommendedPathway" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "learnerInterest" TEXT,
    "teacherRecommendation" TEXT,
    "parentPreference" TEXT,
    "finalApprovedPathway" TEXT,
    "mismatchWarning" TEXT,
    "analysisPayload" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learner_pathway_recommendations_pkey" PRIMARY KEY ("id")
);

DO $$
DECLARE
  id_type TEXT;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'learner_pathway_recommendations'
    AND column_name = 'id';

  IF id_type = 'uuid' THEN
    ALTER TABLE "learner_pathway_recommendations"
      ALTER COLUMN "id" DROP DEFAULT,
      ALTER COLUMN "id" TYPE TEXT USING "id"::text;
  END IF;
END $$;

-- School offerings are always written with an explicit school context by the
-- controller. Safely close the historical nullable-schema gap: a single-school
-- database can be backfilled unambiguously; any ambiguous database is stopped
-- for manual reconciliation instead of assigning rows to the wrong school.
DO $$
DECLARE
  null_count BIGINT;
  school_count BIGINT;
  only_school_id TEXT;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM "school_learning_area_offerings"
  WHERE "schoolId" IS NULL;

  IF null_count > 0 THEN
    SELECT COUNT(*), MIN("id") INTO school_count, only_school_id FROM "schools";
    IF school_count = 1 THEN
      UPDATE "school_learning_area_offerings"
      SET "schoolId" = only_school_id
      WHERE "schoolId" IS NULL;
    ELSE
      RAISE EXCEPTION
        'Pathway Phase 0 migration blocked: % offering row(s) have no school and % schools exist',
        null_count,
        school_count;
    END IF;
  END IF;
END $$;

ALTER TABLE "school_learning_area_offerings"
  ALTER COLUMN "schoolId" SET NOT NULL;

-- Prisma's uuid() and @updatedAt attributes populate these values in the
-- application. Removing legacy database defaults keeps the live schema aligned
-- with schema.prisma while preserving every existing value.
ALTER TABLE "learner_pathway_recommendations"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX IF NOT EXISTS "learner_pathway_recommendations_learnerId_idx"
  ON "learner_pathway_recommendations"("learnerId");

CREATE INDEX IF NOT EXISTS "learner_pathway_recommendations_learnerId_createdAt_idx"
  ON "learner_pathway_recommendations"("learnerId", "createdAt" DESC);

-- Never silently delete legacy orphan rows to make the foreign key fit. Stop
-- the deploy and report the count so the data can be reconciled explicitly.
DO $$
DECLARE
  orphan_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "learner_pathway_recommendations" recommendation
  LEFT JOIN "learners" learner ON learner."id" = recommendation."learnerId"
  WHERE learner."id" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Pathway Phase 0 migration blocked: % recommendation row(s) reference missing learners',
      orphan_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learner_pathway_recommendations_learnerId_fkey'
  ) THEN
    ALTER TABLE "learner_pathway_recommendations"
      ADD CONSTRAINT "learner_pathway_recommendations_learnerId_fkey"
      FOREIGN KEY ("learnerId") REFERENCES "learners"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
