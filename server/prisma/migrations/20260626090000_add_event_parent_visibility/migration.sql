-- Keep existing school databases aligned with the current Event model.
-- Older deployments created the events table before parent visibility controls
-- were added, causing Prisma findMany() calls to fail when selecting the field.

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "isParentVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "academicYear" INTEGER,
ADD COLUMN IF NOT EXISTS "term" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventType') THEN
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'TERM_OPENING';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'TERM_CLOSING';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'MIDTERM_BREAK';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'EXAM_WEEK';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "events_startDate_idx" ON "events"("startDate");
CREATE INDEX IF NOT EXISTS "events_academicYear_term_idx" ON "events"("academicYear", "term");
