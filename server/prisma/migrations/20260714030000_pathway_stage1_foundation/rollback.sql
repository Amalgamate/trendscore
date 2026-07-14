-- Manual data-preserving rollback for Stage 1.
-- The tables remain intact so an application rollback cannot destroy pathway
-- plans, notes, sessions, school preferences, or saved match scores.

ALTER TABLE "counsellor_notes"
  ALTER COLUMN "visibility" SET DEFAULT 'COUNSELLOR_AND_LEARNER';

ALTER TABLE "senior_schools"
  ALTER COLUMN "pathwayCodes" DROP NOT NULL,
  ALTER COLUMN "facilities" DROP NOT NULL,
  ALTER COLUMN "specialNeedsSupport" DROP NOT NULL;

