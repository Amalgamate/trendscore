ALTER TABLE "learning_assignments"
ADD COLUMN "questions" JSONB;

ALTER TABLE "learning_submissions"
ADD COLUMN "questionResponses" JSONB,
ADD COLUMN "autoMarks" DOUBLE PRECISION,
ADD COLUMN "autoMarked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requiresManualMarking" BOOLEAN NOT NULL DEFAULT false;
