-- Audit Fixes: Add NOT_SYNCED to ComplianceStatus enum and feeReminderOptOut to learners
-- Migration: 20261112140000

-- Add NOT_SYNCED value to ComplianceStatus enum
ALTER TYPE "ComplianceStatus" ADD VALUE IF NOT EXISTS 'NOT_SYNCED';

-- Add feeReminderOptOut column to learners table
ALTER TABLE "learners" ADD COLUMN IF NOT EXISTS "feeReminderOptOut" BOOLEAN NOT NULL DEFAULT false;
