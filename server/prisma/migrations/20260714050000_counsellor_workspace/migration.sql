-- Extend the existing pathway case-management models. ADD/CREATE guards keep
-- this migration safe for schools where an earlier draft was applied manually.

ALTER TABLE "action_items"
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "completionNote" TEXT;

ALTER TABLE "counselling_sessions"
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "onlineLink" TEXT,
  ADD COLUMN IF NOT EXISTS "parentParticipants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "outcomeSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "nextActions" TEXT,
  ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'COUNSELLOR_ONLY';

CREATE TABLE IF NOT EXISTS "pathway_interventions" (
  "id" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "interventionType" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "assignedCounsellorId" TEXT,
  "outcome" TEXT,
  "resolutionNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pathway_interventions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pathway_interventions_learnerId_fkey'
  ) THEN
    ALTER TABLE "pathway_interventions"
      ADD CONSTRAINT "pathway_interventions_learnerId_fkey"
      FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pathway_interventions_assignedCounsellorId_fkey'
  ) THEN
    ALTER TABLE "pathway_interventions"
      ADD CONSTRAINT "pathway_interventions_assignedCounsellorId_fkey"
      FOREIGN KEY ("assignedCounsellorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "pathway_interventions_learnerId_status_idx"
  ON "pathway_interventions"("learnerId", "status");
CREATE INDEX IF NOT EXISTS "pathway_interventions_assignedCounsellorId_status_idx"
  ON "pathway_interventions"("assignedCounsellorId", "status");
CREATE INDEX IF NOT EXISTS "pathway_interventions_priority_dueDate_idx"
  ON "pathway_interventions"("priority", "dueDate");
