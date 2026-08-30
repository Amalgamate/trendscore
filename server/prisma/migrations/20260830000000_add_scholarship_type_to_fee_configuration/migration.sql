-- Migration: add scholarshipType and scholarshipAmount to learner_fee_configurations
-- Applied manually (db has drift from migration history; using db execute to stay safe)

ALTER TABLE "learner_fee_configurations"
  ADD COLUMN IF NOT EXISTS "scholarshipType"    VARCHAR(30)     NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "scholarshipAmount"  DECIMAL(10, 2)  NULL;

COMMENT ON COLUMN "learner_fee_configurations"."scholarshipType" IS
  'NONE | FULL | HALF | PARTIAL_AMOUNT';
COMMENT ON COLUMN "learner_fee_configurations"."scholarshipAmount" IS
  'Total the student must pay when scholarshipType = PARTIAL_AMOUNT';
