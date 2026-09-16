-- eReport Engine additive migration (TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md, Phase 3)
-- IDEMPOTENT VERSION: safe to run multiple times. Skips anything that already
-- exists instead of erroring, because a previous `prisma db push` attempt
-- partially applied some of this before failing on unrelated drift.
-- Still purely additive — never alters or drops anything in an existing table.

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
    "termId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "reportData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "report_snapshots_learnerId_termId_idx" ON "report_snapshots"("learnerId", "termId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportEngineAction') THEN
    CREATE TYPE "ReportEngineAction" AS ENUM ('ENGINE_SWITCHED_TO_NEW', 'ENGINE_ROLLED_BACK_TO_LEGACY', 'TEMPLATE_CHANGED');
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
