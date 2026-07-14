-- SPEC-005 Career Explorer
-- Create the catalogue on fresh databases or adopt tables previously created
-- by manual_career_explorer.sql. No catalogue, match, or saved-career rows are
-- deleted by this migration.

SET TIME ZONE 'UTC';

CREATE TABLE IF NOT EXISTS "career_families" (
  "id"          TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "career_families_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "careers" (
  "id"                   TEXT NOT NULL,
  "code"                 TEXT NOT NULL,
  "title"                TEXT NOT NULL,
  "alternativeTitles"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "familyId"             TEXT,
  "shortSummary"         TEXT,
  "fullDescription"      TEXT,
  "typicalActivities"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workEnvironments"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "keySkills"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recommendedPathway"   TEXT,
  "recommendedTrackCode" TEXT,
  "labourMarketNotes"    TEXT,
  "source"               TEXT,
  "verificationStatus"   TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "lastVerifiedAt"       TIMESTAMP(3),
  "publishedAt"          TIMESTAMP(3),
  "retiredAt"            TIMESTAMP(3),
  "active"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "careers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "careers_familyId_fkey" FOREIGN KEY ("familyId")
    REFERENCES "career_families"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "career_alternatives" (
  "id"            TEXT NOT NULL,
  "careerId"      TEXT NOT NULL,
  "alternativeId" TEXT NOT NULL,
  "reason"        TEXT,
  CONSTRAINT "career_alternatives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "career_alternatives_careerId_fkey" FOREIGN KEY ("careerId")
    REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "career_alternatives_alternativeId_fkey" FOREIGN KEY ("alternativeId")
    REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "career_education_routes" (
  "id"                  TEXT NOT NULL,
  "careerId"            TEXT NOT NULL,
  "routeType"           TEXT NOT NULL,
  "qualificationTitle"  TEXT,
  "minSubjectNotes"     TEXT,
  "exampleInstitutions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "durationYears"       DOUBLE PRECISION,
  "progressionOptions"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source"              TEXT,
  "verificationStatus"  TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "active"              BOOLEAN NOT NULL DEFAULT true,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "career_education_routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "career_education_routes_careerId_fkey" FOREIGN KEY ("careerId")
    REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "learner_career_matches" (
  "id"               TEXT NOT NULL,
  "learnerId"        TEXT NOT NULL,
  "careerId"         TEXT NOT NULL,
  "fitScore"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence"       TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  "bucket"           TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  "matchedStrengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "developmentAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "warnings"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "scoreVersion"     TEXT NOT NULL DEFAULT '1.0',
  "generatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_career_matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_career_matches_learnerId_fkey" FOREIGN KEY ("learnerId")
    REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learner_career_matches_careerId_fkey" FOREIGN KEY ("careerId")
    REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "learner_career_saves" (
  "id"            TEXT NOT NULL,
  "learnerId"     TEXT NOT NULL,
  "careerId"      TEXT NOT NULL,
  "savedBy"       TEXT NOT NULL,
  "savedByRole"   TEXT NOT NULL,
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "note"          TEXT,
  "supportStatus" TEXT NOT NULL DEFAULT 'LEARNER_INTERESTED',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_career_saves_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_career_saves_learnerId_fkey" FOREIGN KEY ("learnerId")
    REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learner_career_saves_careerId_fkey" FOREIGN KEY ("careerId")
    REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Remove database-side UUID and updatedAt defaults left by the manual script;
-- Prisma supplies these values through uuid() and @updatedAt.
ALTER TABLE "career_families"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::TIMESTAMP(3);
ALTER TABLE "careers"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "lastVerifiedAt" TYPE TIMESTAMP(3) USING "lastVerifiedAt"::TIMESTAMP(3),
  ALTER COLUMN "publishedAt" TYPE TIMESTAMP(3) USING "publishedAt"::TIMESTAMP(3),
  ALTER COLUMN "retiredAt" TYPE TIMESTAMP(3) USING "retiredAt"::TIMESTAMP(3),
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::TIMESTAMP(3);
ALTER TABLE "career_alternatives" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "career_education_routes"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::TIMESTAMP(3);
ALTER TABLE "learner_career_matches"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "generatedAt" TYPE TIMESTAMP(3) USING "generatedAt"::TIMESTAMP(3),
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::TIMESTAMP(3);
ALTER TABLE "learner_career_saves"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt"::TIMESTAMP(3),
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3) USING "updatedAt"::TIMESTAMP(3);

-- Recreate legacy foreign keys with Prisma's ON UPDATE behavior. Existing
-- constraints already protect these tables from orphaned rows.
ALTER TABLE "careers" DROP CONSTRAINT IF EXISTS "careers_familyId_fkey";
ALTER TABLE "careers" ADD CONSTRAINT "careers_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "career_families"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "career_alternatives" DROP CONSTRAINT IF EXISTS "career_alternatives_careerId_fkey";
ALTER TABLE "career_alternatives" ADD CONSTRAINT "career_alternatives_careerId_fkey"
  FOREIGN KEY ("careerId") REFERENCES "careers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career_alternatives" DROP CONSTRAINT IF EXISTS "career_alternatives_alternativeId_fkey";
ALTER TABLE "career_alternatives" ADD CONSTRAINT "career_alternatives_alternativeId_fkey"
  FOREIGN KEY ("alternativeId") REFERENCES "careers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career_education_routes" DROP CONSTRAINT IF EXISTS "career_education_routes_careerId_fkey";
ALTER TABLE "career_education_routes" ADD CONSTRAINT "career_education_routes_careerId_fkey"
  FOREIGN KEY ("careerId") REFERENCES "careers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_career_matches" DROP CONSTRAINT IF EXISTS "learner_career_matches_learnerId_fkey";
ALTER TABLE "learner_career_matches" ADD CONSTRAINT "learner_career_matches_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_career_matches" DROP CONSTRAINT IF EXISTS "learner_career_matches_careerId_fkey";
ALTER TABLE "learner_career_matches" ADD CONSTRAINT "learner_career_matches_careerId_fkey"
  FOREIGN KEY ("careerId") REFERENCES "careers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_career_saves" DROP CONSTRAINT IF EXISTS "learner_career_saves_learnerId_fkey";
ALTER TABLE "learner_career_saves" ADD CONSTRAINT "learner_career_saves_learnerId_fkey"
  FOREIGN KEY ("learnerId") REFERENCES "learners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_career_saves" DROP CONSTRAINT IF EXISTS "learner_career_saves_careerId_fkey";
ALTER TABLE "learner_career_saves" ADD CONSTRAINT "learner_career_saves_careerId_fkey"
  FOREIGN KEY ("careerId") REFERENCES "careers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "career_families_code_key" ON "career_families"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "careers_code_key" ON "careers"("code");
CREATE INDEX IF NOT EXISTS "careers_familyId_idx" ON "careers"("familyId");
CREATE INDEX IF NOT EXISTS "careers_recommendedPathway_idx" ON "careers"("recommendedPathway");
CREATE INDEX IF NOT EXISTS "careers_verificationStatus_idx" ON "careers"("verificationStatus");
CREATE INDEX IF NOT EXISTS "careers_active_idx" ON "careers"("active");
CREATE UNIQUE INDEX IF NOT EXISTS "career_alternatives_careerId_alternativeId_key"
  ON "career_alternatives"("careerId", "alternativeId");
CREATE INDEX IF NOT EXISTS "career_alternatives_careerId_idx" ON "career_alternatives"("careerId");
CREATE INDEX IF NOT EXISTS "career_education_routes_careerId_idx" ON "career_education_routes"("careerId");
CREATE INDEX IF NOT EXISTS "career_education_routes_routeType_idx" ON "career_education_routes"("routeType");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_career_matches_learnerId_careerId_key"
  ON "learner_career_matches"("learnerId", "careerId");
CREATE INDEX IF NOT EXISTS "learner_career_matches_learnerId_idx" ON "learner_career_matches"("learnerId");
CREATE INDEX IF NOT EXISTS "learner_career_matches_careerId_idx" ON "learner_career_matches"("careerId");
CREATE INDEX IF NOT EXISTS "learner_career_matches_learnerId_fitScore_idx"
  ON "learner_career_matches"("learnerId", "fitScore" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "learner_career_saves_learnerId_careerId_key"
  ON "learner_career_saves"("learnerId", "careerId");
CREATE INDEX IF NOT EXISTS "learner_career_saves_learnerId_idx" ON "learner_career_saves"("learnerId");
CREATE INDEX IF NOT EXISTS "learner_career_saves_careerId_idx" ON "learner_career_saves"("careerId");

-- Remove superseded index names only after their Prisma-standard replacements
-- exist. Unique constraints from the manual script are retained.
DROP INDEX IF EXISTS "careers_family_idx";
DROP INDEX IF EXISTS "careers_pathway_idx";
DROP INDEX IF EXISTS "careers_status_idx";
DROP INDEX IF EXISTS "career_alternatives_career_idx";
DROP INDEX IF EXISTS "career_education_routes_career_idx";
DROP INDEX IF EXISTS "career_education_routes_type_idx";
DROP INDEX IF EXISTS "learner_career_matches_learner_idx";
DROP INDEX IF EXISTS "learner_career_matches_career_idx";
DROP INDEX IF EXISTS "learner_career_matches_score_idx";
DROP INDEX IF EXISTS "learner_career_saves_learner_idx";
DROP INDEX IF EXISTS "learner_career_saves_career_idx";
