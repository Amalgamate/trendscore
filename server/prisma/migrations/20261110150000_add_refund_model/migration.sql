-- Step 4: Refund workflow with owner approval
-- Creates the refunds table and supporting enums for the refund lifecycle:
--   Finance staff submit → SUPER_ADMIN approves → invoice correction +
--   ledger reversal + B2C disbursement (or manual processing)

-- CreateEnum: RefundStatus
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'FAILED', 'MANUAL');

-- CreateEnum: RefundMethod
CREATE TYPE "RefundMethod" AS ENUM ('B2C', 'CASH', 'CHEQUE', 'BANK_TRANSFER');

-- CreateTable: refunds
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "learnerId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "method" "RefundMethod" NOT NULL DEFAULT 'B2C',
    "submittedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "b2cConversationId" TEXT,
    "b2cTransactionId" TEXT,
    "b2cFailureReason" TEXT,
    "approvalRequestId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");
CREATE INDEX "refunds_invoiceId_idx" ON "refunds"("invoiceId");
CREATE INDEX "refunds_learnerId_idx" ON "refunds"("learnerId");
CREATE INDEX "refunds_submittedById_idx" ON "refunds"("submittedById");

-- AddForeignKey: refunds → fee_payments (cascade on delete)
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: refunds → fee_invoices (cascade on delete)
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: refunds → learners (set null on delete)
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: refunds → users (RefundSubmitter — no cascade, restrict delete)
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: refunds → users (RefundApprover — set null on delete)
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: refunds → approval_requests (set null on delete — approval
-- request may be cleaned up but refund record persists)
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approvalRequestId_fkey"
    FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
