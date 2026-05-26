-- Bring fresh databases up to the current School model used by settings,
-- admission numbering, and institution scoping.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdmissionNumberingMode') THEN
    CREATE TYPE "AdmissionNumberingMode" AS ENUM ('AUTO', 'MANUAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdmissionSequenceResetRule') THEN
    CREATE TYPE "AdmissionSequenceResetRule" AS ENUM ('NEVER', 'YEARLY');
  END IF;
END $$;

ALTER TYPE "InstitutionType" ADD VALUE IF NOT EXISTS 'TERTIARY';

ALTER TABLE "schools"
ADD COLUMN IF NOT EXISTS "admissionNumberMode" "AdmissionNumberingMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN IF NOT EXISTS "admissionPattern" TEXT NOT NULL DEFAULT 'ADM-{YEAR}-{SEQ}',
ADD COLUMN IF NOT EXISTS "admissionSequenceWidth" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS "admissionStartNumber" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS "admissionResetRule" "AdmissionSequenceResetRule" NOT NULL DEFAULT 'YEARLY',
ADD COLUMN IF NOT EXISTS "admissionNumberingLocked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "institutionType" "InstitutionType" NOT NULL DEFAULT 'PRIMARY_CBC',
ADD COLUMN IF NOT EXISTS "primaryColor" TEXT,
ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT,
ADD COLUMN IF NOT EXISTS "accentColor1" TEXT,
ADD COLUMN IF NOT EXISTS "accentColor2" TEXT,
ADD COLUMN IF NOT EXISTS "kraPin" TEXT,
ADD COLUMN IF NOT EXISTS "vatNumber" TEXT,
ADD COLUMN IF NOT EXISTS "etimsConfig" JSONB,
ADD COLUMN IF NOT EXISTS "nemisConfig" JSONB;

CREATE INDEX IF NOT EXISTS "schools_kraPin_idx" ON "schools"("kraPin");
