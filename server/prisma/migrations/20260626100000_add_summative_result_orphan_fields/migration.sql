ALTER TABLE "summative_results"
ADD COLUMN IF NOT EXISTS "orphanFields" JSONB;
