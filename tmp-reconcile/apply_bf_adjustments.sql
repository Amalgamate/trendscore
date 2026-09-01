BEGIN;
WITH adjustments(adm, bf_amount) AS (
  VALUES
    ('1132', 10900.00::numeric),
    ('1439', 5100.00::numeric),
    ('341', 1000.00::numeric),
    ('573', 16800.00::numeric),
    ('574', 33200.00::numeric)
), target AS (
  SELECT fi.id, a.adm, a.bf_amount
  FROM fee_invoices fi
  JOIN learners l ON l.id = fi."learnerId"
  JOIN adjustments a ON a.adm = l."admissionNumber"
  WHERE fi.term = 'TERM_2'
    AND fi."academicYear" = 2026
    AND fi.archived = false
)
UPDATE fee_invoices fi
SET
  "carryForwardAmount" = COALESCE(fi."carryForwardAmount", 0) + target.bf_amount,
  "totalAmount" = fi."totalAmount" + target.bf_amount,
  balance = fi.balance + target.bf_amount,
  "updatedAt" = NOW()
FROM target
WHERE fi.id = target.id;
COMMIT;
