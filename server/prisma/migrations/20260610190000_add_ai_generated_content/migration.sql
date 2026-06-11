-- Add AI-generated content persistence for Phase 1 intelligence features.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AIContentType') THEN
    CREATE TYPE "AIContentType" AS ENUM (
      'REPORT_COMMENT',
      'PARENT_MESSAGE',
      'ACADEMIC_ANALYSIS',
      'DAILY_BRIEF',
      'RISK_ANALYSIS',
      'CAREER_GUIDANCE',
      'COMMUNICATION_DRAFT',
      'NL_ANSWER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ai_generated_content" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "type" "AIContentType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "prompt" TEXT,
  "provider" TEXT,
  "tokensUsed" INTEGER,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ai_generated_content_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_generated_content_schoolId_idx" ON "ai_generated_content"("schoolId");
CREATE INDEX IF NOT EXISTS "ai_generated_content_type_idx" ON "ai_generated_content"("type");
CREATE INDEX IF NOT EXISTS "ai_generated_content_entityType_entityId_idx" ON "ai_generated_content"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ai_generated_content_createdBy_idx" ON "ai_generated_content"("createdBy");
CREATE INDEX IF NOT EXISTS "ai_generated_content_createdAt_idx" ON "ai_generated_content"("createdAt");
CREATE INDEX IF NOT EXISTS "ai_generated_content_archived_idx" ON "ai_generated_content"("archived");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_generated_content_schoolId_fkey') THEN
    ALTER TABLE "ai_generated_content"
    ADD CONSTRAINT "ai_generated_content_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
