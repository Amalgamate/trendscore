-- Decision Plan lifecycle: immutable submissions, revision records and actor
-- attribution for every review/approval transition.

ALTER TYPE "DecisionPlanStatus" ADD VALUE IF NOT EXISTS 'REVISION_REQUIRED';

ALTER TABLE "decision_plans"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "submittedById" TEXT,
  ADD COLUMN IF NOT EXISTS "parentReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "counsellorReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "lockedById" TEXT;

CREATE TABLE IF NOT EXISTS "decision_plan_submissions" (
  "id"             TEXT NOT NULL,
  "decisionPlanId" TEXT NOT NULL,
  "version"        INTEGER NOT NULL,
  "snapshot"       JSONB NOT NULL,
  "submittedById"  TEXT NOT NULL,
  "submittedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_plan_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "decision_plan_revisions" (
  "id"              TEXT NOT NULL,
  "decisionPlanId"  TEXT NOT NULL,
  "reasonCategory"  TEXT NOT NULL,
  "explanation"     TEXT NOT NULL,
  "affectedSection" TEXT NOT NULL,
  "requiredAction"  TEXT NOT NULL,
  "dueDate"         TIMESTAMP(3),
  "requestedById"   TEXT NOT NULL,
  "requestedByRole" TEXT NOT NULL,
  "resolvedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_plan_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "decision_plan_submissions_decisionPlanId_version_key"
  ON "decision_plan_submissions"("decisionPlanId", "version");
CREATE INDEX IF NOT EXISTS "decision_plan_submissions_decisionPlanId_submittedAt_idx"
  ON "decision_plan_submissions"("decisionPlanId", "submittedAt" DESC);
CREATE INDEX IF NOT EXISTS "decision_plan_revisions_decisionPlanId_createdAt_idx"
  ON "decision_plan_revisions"("decisionPlanId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "decision_plan_revisions_resolvedAt_idx"
  ON "decision_plan_revisions"("resolvedAt");

ALTER TABLE "decision_plan_submissions"
  DROP CONSTRAINT IF EXISTS "decision_plan_submissions_decisionPlanId_fkey";
ALTER TABLE "decision_plan_submissions"
  ADD CONSTRAINT "decision_plan_submissions_decisionPlanId_fkey"
  FOREIGN KEY ("decisionPlanId") REFERENCES "decision_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_plan_revisions"
  DROP CONSTRAINT IF EXISTS "decision_plan_revisions_decisionPlanId_fkey";
ALTER TABLE "decision_plan_revisions"
  ADD CONSTRAINT "decision_plan_revisions_decisionPlanId_fkey"
  FOREIGN KEY ("decisionPlanId") REFERENCES "decision_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

