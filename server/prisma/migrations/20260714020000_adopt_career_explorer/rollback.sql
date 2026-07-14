-- Manual, data-preserving rollback for the Career Explorer adoption.
-- Tables and rows intentionally remain available to the legacy/manual path.
ALTER TABLE "career_families" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "careers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "career_alternatives" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "career_education_routes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "learner_career_matches" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "learner_career_saves" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE "career_families" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "careers" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "career_education_routes" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "learner_career_matches" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "learner_career_saves" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

