ALTER TABLE "fee_invoices"
  ADD COLUMN IF NOT EXISTS "grossAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adjustmentAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "sponsorAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "sponsorPaidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sponsorBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "studentAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "carryForwardAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "calculationSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "feeConfigurationId" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionNumber" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "fee_payments"
  ADD COLUMN IF NOT EXISTS "payerType" TEXT NOT NULL DEFAULT 'STUDENT';

CREATE TABLE IF NOT EXISTS "learner_fee_configurations" (
  "id" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startTerm" "Term" NOT NULL,
  "startAcademicYear" INTEGER NOT NULL,
  "endTerm" "Term",
  "endAcademicYear" INTEGER,
  "fullExemption" BOOLEAN NOT NULL DEFAULT false,
  "sponsorName" TEXT,
  "sponsorReference" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "adjustments" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_fee_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_fee_configurations_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "learner_fee_configurations_learnerId_status_idx"
  ON "learner_fee_configurations"("learnerId", "status");
CREATE INDEX IF NOT EXISTS "learner_fee_configurations_startAcademicYear_startTerm_idx"
  ON "learner_fee_configurations"("startAcademicYear", "startTerm");

CREATE TABLE IF NOT EXISTS "fee_invoice_revisions" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "previousSnapshot" JSONB NOT NULL,
  "revisedSnapshot" JSONB NOT NULL,
  "revisedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_invoice_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_invoice_revisions_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoice_revisions_invoiceId_revisionNumber_key"
  ON "fee_invoice_revisions"("invoiceId", "revisionNumber");
CREATE INDEX IF NOT EXISTS "fee_invoice_revisions_invoiceId_idx"
  ON "fee_invoice_revisions"("invoiceId");
