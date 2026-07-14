ALTER TABLE "senior_schools"
  ADD COLUMN IF NOT EXISTS "trackCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "combinationCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "faithAffiliation" TEXT;

ALTER TABLE "learner_school_search_criteria"
  ADD COLUMN IF NOT EXISTS "boardingRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "countyRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "requiredSupport" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "school_corrections"
  ADD COLUMN IF NOT EXISTS "evidence" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionReason" TEXT;

ALTER TABLE "school_corrections" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
UPDATE "school_corrections" SET "status" = 'SUBMITTED' WHERE "status" = 'PENDING';
UPDATE "school_corrections" SET "status" = 'APPROVED' WHERE "status" = 'ACCEPTED';

CREATE INDEX IF NOT EXISTS "senior_schools_verificationStatus_idx"
  ON "senior_schools"("verificationStatus");
CREATE INDEX IF NOT EXISTS "school_match_scores_learnerId_score_idx"
  ON "school_match_scores"("learnerId", "score" DESC);
