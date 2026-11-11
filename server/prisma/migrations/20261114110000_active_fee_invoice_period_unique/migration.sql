-- Enforce one non-archived, non-cancelled invoice per learner, fee structure,
-- term, and academic year. Cancelled/archived invoices remain in the audit
-- history and may be replaced with a new invoice.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM fee_invoices
    WHERE archived = false
      AND status <> 'CANCELLED'
    GROUP BY "learnerId", "feeStructureId", term, "academicYear"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Active duplicate fee invoices exist. Resolve duplicates before applying the active invoice uniqueness constraint.';
  END IF;
END $$;

CREATE UNIQUE INDEX "fee_invoices_active_period_unique"
  ON fee_invoices ("learnerId", "feeStructureId", term, "academicYear")
  WHERE archived = false AND status <> 'CANCELLED';
