SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
  SELECT
    fi.id,
    fi."invoiceNumber",
    l."admissionNumber",
    l."firstName",
    l."lastName",
    fi.term,
    fi."academicYear",
    fi."totalAmount",
    fi."paidAmount",
    fi.balance,
    fi.status,
    fi."carryForwardAmount",
    fi."studentAmount"
  FROM fee_invoices fi
  JOIN learners l ON l.id = fi."learnerId"
  WHERE fi."academicYear" = 2026
    AND fi.term IN ('TERM_1', 'TERM_2')
    AND fi.archived = false
    AND l."admissionNumber" IN ('1132','1439','341','573','574')
  ORDER BY l."admissionNumber", fi.term
) t;
