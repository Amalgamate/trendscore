-- Add fee collection follow-up tables referenced by the current invoice model.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommentType') THEN
    CREATE TYPE "CommentType" AS ENUM ('NOTE', 'PLEDGE', 'CALL_LOG', 'REMINDER_SENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PledgeStatus') THEN
    CREATE TYPE "PledgeStatus" AS ENUM ('PENDING', 'DUE', 'FULFILLED', 'CANCELLED', 'BROKEN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WaiverStatus') THEN
    CREATE TYPE "WaiverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fee_comments" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "CommentType" NOT NULL DEFAULT 'NOTE',
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "fee_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_pledges" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "commentId" TEXT,
  "pledgedAmount" DECIMAL(10, 2) NOT NULL,
  "pledgeDate" TIMESTAMP(3) NOT NULL,
  "status" "PledgeStatus" NOT NULL DEFAULT 'PENDING',
  "fulfilledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "fee_pledges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fee_waivers" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amountWaived" DECIMAL(10, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "waiverCategory" TEXT DEFAULT 'OTHER',
  "status" "WaiverStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "fee_waivers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_pledges_commentId_key" ON "fee_pledges"("commentId");
CREATE INDEX IF NOT EXISTS "fee_comments_invoiceId_idx" ON "fee_comments"("invoiceId");
CREATE INDEX IF NOT EXISTS "fee_comments_type_idx" ON "fee_comments"("type");
CREATE INDEX IF NOT EXISTS "fee_comments_createdAt_idx" ON "fee_comments"("createdAt");
CREATE INDEX IF NOT EXISTS "fee_pledges_invoiceId_idx" ON "fee_pledges"("invoiceId");
CREATE INDEX IF NOT EXISTS "fee_pledges_pledgeDate_idx" ON "fee_pledges"("pledgeDate");
CREATE INDEX IF NOT EXISTS "fee_pledges_status_idx" ON "fee_pledges"("status");
CREATE INDEX IF NOT EXISTS "fee_waivers_invoiceId_idx" ON "fee_waivers"("invoiceId");
CREATE INDEX IF NOT EXISTS "fee_waivers_status_idx" ON "fee_waivers"("status");
CREATE INDEX IF NOT EXISTS "fee_waivers_createdAt_idx" ON "fee_waivers"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_comments_invoiceId_fkey') THEN
    ALTER TABLE "fee_comments" ADD CONSTRAINT "fee_comments_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_comments_createdById_fkey') THEN
    ALTER TABLE "fee_comments" ADD CONSTRAINT "fee_comments_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_pledges_invoiceId_fkey') THEN
    ALTER TABLE "fee_pledges" ADD CONSTRAINT "fee_pledges_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_pledges_commentId_fkey') THEN
    ALTER TABLE "fee_pledges" ADD CONSTRAINT "fee_pledges_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "fee_comments"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_pledges_createdById_fkey') THEN
    ALTER TABLE "fee_pledges" ADD CONSTRAINT "fee_pledges_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_waivers_invoiceId_fkey') THEN
    ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_waivers_createdById_fkey') THEN
    ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_waivers_approvedById_fkey') THEN
    ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
