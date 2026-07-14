-- Manual, data-preserving rollback for Pathway Planner Phase 0.
-- Revert the application service to its legacy raw-SQL implementation first.
-- This intentionally keeps the table and all recommendation history.

ALTER TABLE "learner_pathway_recommendations"
  DROP CONSTRAINT IF EXISTS "learner_pathway_recommendations_learnerId_fkey";

ALTER TABLE "learner_pathway_recommendations"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "school_learning_area_offerings"
  ALTER COLUMN "schoolId" DROP NOT NULL;

-- The legacy service accepts TEXT ids as PostgreSQL parameters, so converting
-- the primary key back to UUID is unnecessary and could make rollback fail if
-- a non-UUID id was written after deployment.
