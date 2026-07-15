ALTER TABLE "senior_schools" ADD COLUMN IF NOT EXISTS "clubs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "senior_schools" ADD COLUMN IF NOT EXISTS "annualCostNotes" TEXT;
ALTER TABLE "senior_schools" ADD COLUMN IF NOT EXISTS "performanceNotes" TEXT;
ALTER TABLE "senior_schools" ADD COLUMN IF NOT EXISTS "transitionNotes" TEXT;

CREATE TABLE IF NOT EXISTS "pathway_conversation_messages" (
  "id" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pathway_conversation_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pathway_conversation_messages_learnerId_createdAt_idx" ON "pathway_conversation_messages"("learnerId", "createdAt");
DO $$ BEGIN ALTER TABLE "pathway_conversation_messages" ADD CONSTRAINT "pathway_conversation_messages_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
