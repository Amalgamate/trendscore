ALTER TABLE "communication_configs"
  ADD COLUMN IF NOT EXISTS "mpesaOnboardingChecklist" JSONB,
  ADD COLUMN IF NOT EXISTS "mpesaOnboardingUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mpesaOnboardingUpdatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "mpesaPasskey" TEXT;
