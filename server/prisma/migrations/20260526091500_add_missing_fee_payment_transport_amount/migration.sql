-- Add current transport allocation field used when recording fee payments.
ALTER TABLE "fee_payments"
ADD COLUMN IF NOT EXISTS "transportAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;
