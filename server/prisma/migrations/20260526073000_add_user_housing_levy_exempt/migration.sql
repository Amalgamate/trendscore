-- Add missing payroll exemption flag used by the current Prisma schema.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "housingLevyExempt" BOOLEAN NOT NULL DEFAULT false;
