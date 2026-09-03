-- Add StaffAllowance table for per-staff recurring allowances
CREATE TABLE IF NOT EXISTS "staff_allowances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_allowances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_allowances" ADD CONSTRAINT "staff_allowances_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "staff_allowances_userId_idx" ON "staff_allowances"("userId");

-- Add StaffDeduction table for custom (non-statutory) deductions  
-- e.g. loans, SACCO, salary advances
CREATE TABLE IF NOT EXISTS "staff_deductions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,           -- LOAN | SACCO | ADVANCE | OTHER
    "label" TEXT NOT NULL,          -- display name e.g. "Equity SACCO"
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "totalMonths" INTEGER NOT NULL DEFAULT 0,   -- 0 = indefinite
    "monthsApplied" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_deductions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_deductions" ADD CONSTRAINT "staff_deductions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "staff_deductions_userId_idx" ON "staff_deductions"("userId");

-- Extend payroll_records with gross salary and payment tracking
ALTER TABLE "payroll_records"
    ADD COLUMN IF NOT EXISTS "grossSalary" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
