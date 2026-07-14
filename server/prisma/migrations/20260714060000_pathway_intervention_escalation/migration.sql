ALTER TABLE "pathway_interventions"
  ADD COLUMN IF NOT EXISTS "escalationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escalatedById" TEXT;

CREATE INDEX IF NOT EXISTS "pathway_interventions_escalatedAt_idx"
  ON "pathway_interventions"("escalatedAt");
