-- Event audience + per-class targeting, and the event types the Annual Planner UI already offers.
-- Idempotent so existing school databases can be brought up to date safely.

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "audience" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "classIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventType') THEN
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'ASSESSMENT';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'FINANCE';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'TRIP';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'STAFF_EVENT';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PARENT_EVENT';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'NATIONAL_EVENT';
    ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'OTHER';
  END IF;
END $$;
