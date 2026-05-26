-- Add missing learner UPI field used by the current Prisma schema.
ALTER TABLE "learners"
ADD COLUMN IF NOT EXISTS "upiNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "learners_upiNumber_key"
ON "learners"("upiNumber");
