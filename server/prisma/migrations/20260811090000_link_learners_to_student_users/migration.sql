-- Give each learner an explicit, durable link to their student portal account.
-- Username/admission-number matching remains a legacy fallback only.
ALTER TABLE "learners" ADD COLUMN "studentUserId" TEXT;

CREATE UNIQUE INDEX "learners_studentUserId_key" ON "learners"("studentUserId");

ALTER TABLE "learners"
ADD CONSTRAINT "learners_studentUserId_fkey"
FOREIGN KEY ("studentUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
