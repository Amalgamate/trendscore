CREATE TABLE IF NOT EXISTS "learner_pathway_profiles" (
  "id" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "interestAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "strengthAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredActivities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aspirations" TEXT,
  "learningPreference" TEXT,
  "confidenceAreas" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learner_pathway_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "learner_pathway_profiles_learnerId_key"
  ON "learner_pathway_profiles"("learnerId");
CREATE INDEX IF NOT EXISTS "learner_pathway_profiles_updatedAt_idx"
  ON "learner_pathway_profiles"("updatedAt");

DO $$ BEGIN
  ALTER TABLE "learner_pathway_profiles"
    ADD CONSTRAINT "learner_pathway_profiles_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
