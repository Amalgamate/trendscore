-- Pathway Decision Centre Stage 1 foundation
--
-- This migration replaces _stage1_diff.sql and add_note_visibility.sql. Every
-- CREATE is adoption-safe because some development databases received those
-- scripts manually before a versioned migration existed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DecisionPlanStatus') THEN
    CREATE TYPE "DecisionPlanStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'PARENT_REVIEWED',
      'COUNSELLOR_REVIEWED',
      'APPROVED',
      'LOCKED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "counsellor_notes" (
  "id"         TEXT NOT NULL,
  "learnerId"  TEXT NOT NULL,
  "authorId"   TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "note"       TEXT NOT NULL,
  "noteType"   TEXT NOT NULL DEFAULT 'GENERAL',
  "visibility" TEXT NOT NULL DEFAULT 'COUNSELLOR_ONLY',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "counsellor_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "counsellor_notes"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'COUNSELLOR_ONLY';
ALTER TABLE "counsellor_notes"
  ALTER COLUMN "visibility" SET DEFAULT 'COUNSELLOR_ONLY';

CREATE TABLE IF NOT EXISTS "senior_schools" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "knecCode"            TEXT,
  "county"              TEXT NOT NULL,
  "subCounty"           TEXT,
  "schoolType"          TEXT NOT NULL DEFAULT 'DAY',
  "gender"              TEXT NOT NULL DEFAULT 'MIXED',
  "category"            TEXT,
  "pathwayCodes"        TEXT[] NOT NULL,
  "minimumKcpeGrade"    DOUBLE PRECISION,
  "website"             TEXT,
  "phone"               TEXT,
  "active"              BOOLEAN NOT NULL DEFAULT true,
  "verified"            BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus"  TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt"          TIMESTAMP(3),
  "dataSource"          TEXT,
  "affordabilityBand"   TEXT,
  "facilities"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "specialNeedsSupport" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "latitude"            DOUBLE PRECISION,
  "longitude"           DOUBLE PRECISION,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "senior_schools_pkey" PRIMARY KEY ("id")
);

-- The loose diff accidentally left required arrays nullable. Null represented
-- no known values, so normalize it to the schema's empty-array representation.
UPDATE "senior_schools" SET "pathwayCodes" = ARRAY[]::TEXT[] WHERE "pathwayCodes" IS NULL;
UPDATE "senior_schools" SET "facilities" = ARRAY[]::TEXT[] WHERE "facilities" IS NULL;
UPDATE "senior_schools" SET "specialNeedsSupport" = ARRAY[]::TEXT[] WHERE "specialNeedsSupport" IS NULL;
ALTER TABLE "senior_schools"
  ALTER COLUMN "pathwayCodes" SET NOT NULL,
  ALTER COLUMN "facilities" SET NOT NULL,
  ALTER COLUMN "specialNeedsSupport" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "learner_school_preferences" (
  "id"        TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "rank"      INTEGER NOT NULL,
  "source"    TEXT NOT NULL DEFAULT 'LEARNER',
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_school_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "decision_plans" (
  "id"                   TEXT NOT NULL,
  "learnerId"            TEXT NOT NULL,
  "status"               "DecisionPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt"          TIMESTAMP(3),
  "parentReviewedAt"     TIMESTAMP(3),
  "counsellorReviewedAt" TIMESTAMP(3),
  "approvedAt"           TIMESTAMP(3),
  "lockedAt"             TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "decision_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "learner_action_plans" (
  "id"             TEXT NOT NULL,
  "learnerId"      TEXT NOT NULL,
  "decisionPlanId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_action_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "action_items" (
  "id"             TEXT NOT NULL,
  "actionPlanId"   TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "assignedToRole" TEXT NOT NULL DEFAULT 'STUDENT',
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "dueDate"        TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "parent_comments" (
  "id"             TEXT NOT NULL,
  "learnerId"      TEXT NOT NULL,
  "decisionPlanId" TEXT,
  "authorId"       TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "visibility"     TEXT NOT NULL DEFAULT 'COUNSELLOR_ONLY',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parent_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "counselling_sessions" (
  "id"              TEXT NOT NULL,
  "learnerId"       TEXT NOT NULL,
  "counsellorId"    TEXT,
  "scheduledAt"     TIMESTAMP(3),
  "durationMinutes" INTEGER DEFAULT 30,
  "mode"            TEXT NOT NULL DEFAULT 'IN_PERSON',
  "status"          TEXT NOT NULL DEFAULT 'SCHEDULED',
  "priority"        TEXT NOT NULL DEFAULT 'MEDIUM',
  "reason"          TEXT,
  "notes"           TEXT,
  "resolvedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "counselling_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "school_match_scores" (
  "id"           TEXT NOT NULL,
  "learnerId"    TEXT NOT NULL,
  "schoolId"     TEXT NOT NULL,
  "score"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bucket"       TEXT NOT NULL DEFAULT 'TARGET',
  "breakdown"    JSONB,
  "scoreVersion" TEXT NOT NULL DEFAULT '1.0',
  "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_match_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "school_corrections" (
  "id"             TEXT NOT NULL,
  "schoolId"       TEXT NOT NULL,
  "submittedById"  TEXT NOT NULL,
  "field"          TEXT NOT NULL,
  "currentValue"   TEXT,
  "suggestedValue" TEXT NOT NULL,
  "reason"         TEXT,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedById"   TEXT,
  "reviewedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pathway_selection_unlocks" (
  "id"         TEXT NOT NULL,
  "learnerId"  TEXT NOT NULL,
  "unlockedBy" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"      TEXT,
  CONSTRAINT "pathway_selection_unlocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "counsellor_notes_learnerId_idx" ON "counsellor_notes"("learnerId");
CREATE INDEX IF NOT EXISTS "counsellor_notes_authorId_idx" ON "counsellor_notes"("authorId");
CREATE UNIQUE INDEX IF NOT EXISTS "senior_schools_knecCode_key" ON "senior_schools"("knecCode");
CREATE INDEX IF NOT EXISTS "senior_schools_county_idx" ON "senior_schools"("county");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_school_preferences_learnerId_schoolId_key"
  ON "learner_school_preferences"("learnerId", "schoolId");
CREATE INDEX IF NOT EXISTS "learner_school_preferences_learnerId_idx"
  ON "learner_school_preferences"("learnerId");
CREATE UNIQUE INDEX IF NOT EXISTS "decision_plans_learnerId_key" ON "decision_plans"("learnerId");
CREATE INDEX IF NOT EXISTS "decision_plans_learnerId_idx" ON "decision_plans"("learnerId");
CREATE INDEX IF NOT EXISTS "decision_plans_status_idx" ON "decision_plans"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_action_plans_learnerId_key"
  ON "learner_action_plans"("learnerId");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_action_plans_decisionPlanId_key"
  ON "learner_action_plans"("decisionPlanId");
CREATE INDEX IF NOT EXISTS "action_items_actionPlanId_idx" ON "action_items"("actionPlanId");
CREATE INDEX IF NOT EXISTS "action_items_status_idx" ON "action_items"("status");
CREATE INDEX IF NOT EXISTS "parent_comments_learnerId_idx" ON "parent_comments"("learnerId");
CREATE INDEX IF NOT EXISTS "parent_comments_decisionPlanId_idx" ON "parent_comments"("decisionPlanId");
CREATE INDEX IF NOT EXISTS "counselling_sessions_learnerId_idx" ON "counselling_sessions"("learnerId");
CREATE INDEX IF NOT EXISTS "counselling_sessions_status_idx" ON "counselling_sessions"("status");
CREATE INDEX IF NOT EXISTS "counselling_sessions_priority_idx" ON "counselling_sessions"("priority");
CREATE UNIQUE INDEX IF NOT EXISTS "school_match_scores_learnerId_schoolId_key"
  ON "school_match_scores"("learnerId", "schoolId");
CREATE INDEX IF NOT EXISTS "school_match_scores_learnerId_idx" ON "school_match_scores"("learnerId");
CREATE INDEX IF NOT EXISTS "school_match_scores_schoolId_idx" ON "school_match_scores"("schoolId");
CREATE INDEX IF NOT EXISTS "school_corrections_schoolId_idx" ON "school_corrections"("schoolId");
CREATE INDEX IF NOT EXISTS "school_corrections_status_idx" ON "school_corrections"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "pathway_selection_unlocks_learnerId_key"
  ON "pathway_selection_unlocks"("learnerId");

-- Recreate all relations with Prisma's explicit referential actions. This is
-- safe for adopted tables because the manually-created relations already
-- enforced the same row integrity.
ALTER TABLE "counsellor_notes" DROP CONSTRAINT IF EXISTS "counsellor_notes_learnerId_fkey";
ALTER TABLE "counsellor_notes" ADD CONSTRAINT "counsellor_notes_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "counsellor_notes" DROP CONSTRAINT IF EXISTS "counsellor_notes_authorId_fkey";
ALTER TABLE "counsellor_notes" ADD CONSTRAINT "counsellor_notes_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learner_school_preferences" DROP CONSTRAINT IF EXISTS "learner_school_preferences_learnerId_fkey";
ALTER TABLE "learner_school_preferences" ADD CONSTRAINT "learner_school_preferences_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_school_preferences" DROP CONSTRAINT IF EXISTS "learner_school_preferences_schoolId_fkey";
ALTER TABLE "learner_school_preferences" ADD CONSTRAINT "learner_school_preferences_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "senior_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "decision_plans" DROP CONSTRAINT IF EXISTS "decision_plans_learnerId_fkey";
ALTER TABLE "decision_plans" ADD CONSTRAINT "decision_plans_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_action_plans" DROP CONSTRAINT IF EXISTS "learner_action_plans_learnerId_fkey";
ALTER TABLE "learner_action_plans" ADD CONSTRAINT "learner_action_plans_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_action_plans" DROP CONSTRAINT IF EXISTS "learner_action_plans_decisionPlanId_fkey";
ALTER TABLE "learner_action_plans" ADD CONSTRAINT "learner_action_plans_decisionPlanId_fkey"
  FOREIGN KEY ("decisionPlanId") REFERENCES "decision_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" DROP CONSTRAINT IF EXISTS "action_items_actionPlanId_fkey";
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_actionPlanId_fkey"
  FOREIGN KEY ("actionPlanId") REFERENCES "learner_action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_comments" DROP CONSTRAINT IF EXISTS "parent_comments_learnerId_fkey";
ALTER TABLE "parent_comments" ADD CONSTRAINT "parent_comments_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_comments" DROP CONSTRAINT IF EXISTS "parent_comments_decisionPlanId_fkey";
ALTER TABLE "parent_comments" ADD CONSTRAINT "parent_comments_decisionPlanId_fkey"
  FOREIGN KEY ("decisionPlanId") REFERENCES "decision_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parent_comments" DROP CONSTRAINT IF EXISTS "parent_comments_authorId_fkey";
ALTER TABLE "parent_comments" ADD CONSTRAINT "parent_comments_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselling_sessions" DROP CONSTRAINT IF EXISTS "counselling_sessions_learnerId_fkey";
ALTER TABLE "counselling_sessions" ADD CONSTRAINT "counselling_sessions_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "counselling_sessions" DROP CONSTRAINT IF EXISTS "counselling_sessions_counsellorId_fkey";
ALTER TABLE "counselling_sessions" ADD CONSTRAINT "counselling_sessions_counsellorId_fkey"
  FOREIGN KEY ("counsellorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school_match_scores" DROP CONSTRAINT IF EXISTS "school_match_scores_learnerId_fkey";
ALTER TABLE "school_match_scores" ADD CONSTRAINT "school_match_scores_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_match_scores" DROP CONSTRAINT IF EXISTS "school_match_scores_schoolId_fkey";
ALTER TABLE "school_match_scores" ADD CONSTRAINT "school_match_scores_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "senior_schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_corrections" DROP CONSTRAINT IF EXISTS "school_corrections_schoolId_fkey";
ALTER TABLE "school_corrections" ADD CONSTRAINT "school_corrections_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "senior_schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pathway_selection_unlocks" DROP CONSTRAINT IF EXISTS "pathway_selection_unlocks_learnerId_fkey";
ALTER TABLE "pathway_selection_unlocks" ADD CONSTRAINT "pathway_selection_unlocks_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pathway_selection_unlocks" DROP CONSTRAINT IF EXISTS "pathway_selection_unlocks_unlockedBy_fkey";
ALTER TABLE "pathway_selection_unlocks" ADD CONSTRAINT "pathway_selection_unlocks_unlockedBy_fkey"
  FOREIGN KEY ("unlockedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

