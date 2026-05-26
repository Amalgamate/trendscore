-- Sync fresh databases with current assessment grading and fee invoice fields.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ComplianceStatus') THEN
    CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'EXEMPT');
  END IF;
END $$;

ALTER TABLE "formative_assessments"
ADD COLUMN IF NOT EXISTS "level_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formative_assessments_level_id_fkey'
  ) THEN
    ALTER TABLE "formative_assessments"
    ADD CONSTRAINT "formative_assessments_level_id_fkey"
    FOREIGN KEY ("level_id") REFERENCES "grading_ranges"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "formative_assessments_level_id_idx"
ON "formative_assessments"("level_id");

ALTER TABLE "fee_invoices"
ADD COLUMN IF NOT EXISTS "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "etimsControlCode" TEXT,
ADD COLUMN IF NOT EXISTS "etimsQRCodeUrl" TEXT,
ADD COLUMN IF NOT EXISTS "transportBilled" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "transportPaid" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "transportBalance" DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "fee_invoices_archived_transportBilled_idx"
ON "fee_invoices"("archived", "transportBilled");
