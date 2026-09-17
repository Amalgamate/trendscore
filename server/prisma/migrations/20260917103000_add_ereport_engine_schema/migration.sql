-- Complete the eReport rollout for installations that received the backend
-- image before its database schema.  Every operation is additive and guarded
-- so this also repairs databases where the earlier manual SQL was partially
-- applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportEngine') THEN
    CREATE TYPE "ReportEngine" AS ENUM ('LEGACY', 'NEW');
  END IF;
END $$;

ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "reportEngine" "ReportEngine" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN IF NOT EXISTS "reportTemplateId" TEXT;

CREATE TABLE IF NOT EXISTS "report_templates" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "report_templates_key_key" ON "report_templates"("key");
CREATE INDEX IF NOT EXISTS "report_templates_isActive_idx" ON "report_templates"("isActive");

CREATE TABLE IF NOT EXISTS "report_snapshots" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "learnerId" TEXT NOT NULL,
  "term" "Term" NOT NULL,
  "academicYear" INTEGER NOT NULL,
  "templateId" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "reportData" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedBy" TEXT NOT NULL,
  CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

-- An early manual rollout used termId.  No reports were issued through the
-- NEW engine, so remove that obsolete column if it is present.
ALTER TABLE "report_snapshots" DROP COLUMN IF EXISTS "termId";

-- The manual rollout could already have created the table with the obsolete
-- termId shape.  Bring that table to the model's (term, academicYear) shape.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'report_snapshots' AND column_name = 'term'
  ) THEN
    ALTER TABLE "report_snapshots" ADD COLUMN "term" "Term" NOT NULL DEFAULT 'TERM_1';
    ALTER TABLE "report_snapshots" ALTER COLUMN "term" DROP DEFAULT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'report_snapshots' AND column_name = 'academicYear'
  ) THEN
    ALTER TABLE "report_snapshots" ADD COLUMN "academicYear" INTEGER NOT NULL DEFAULT 2026;
    ALTER TABLE "report_snapshots" ALTER COLUMN "academicYear" DROP DEFAULT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "report_snapshots_learnerId_term_academicYear_key"
  ON "report_snapshots"("learnerId", "term", "academicYear");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportEngineAction') THEN
    CREATE TYPE "ReportEngineAction" AS ENUM (
      'ENGINE_SWITCHED_TO_NEW', 'ENGINE_ROLLED_BACK_TO_LEGACY', 'TEMPLATE_CHANGED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "report_engine_audit_logs" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "schoolId" TEXT NOT NULL,
  "action" "ReportEngineAction" NOT NULL,
  "fromValue" TEXT,
  "toValue" TEXT,
  "performedBy" TEXT NOT NULL,
  "roleAtTime" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_engine_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "report_engine_audit_logs_schoolId_idx" ON "report_engine_audit_logs"("schoolId");
CREATE INDEX IF NOT EXISTS "report_engine_audit_logs_performedBy_idx" ON "report_engine_audit_logs"("performedBy");
CREATE INDEX IF NOT EXISTS "report_engine_audit_logs_createdAt_idx" ON "report_engine_audit_logs"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_engine_audit_logs_performedBy_fkey'
  ) THEN
    ALTER TABLE "report_engine_audit_logs"
      ADD CONSTRAINT "report_engine_audit_logs_performedBy_fkey"
      FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
