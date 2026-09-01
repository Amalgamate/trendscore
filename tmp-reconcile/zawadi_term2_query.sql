SELECT json_agg(row_to_json(t))
FROM (
  SELECT
    fi.id,
    fi."invoiceNumber",
    fi."learnerId",
    l."admissionNumber",
    l."firstName",
    l."lastName",
    l.grade,
    l.stream,
    fi.term,
    fi."academicYear",
    fi."totalAmount",
    fi."paidAmount",
    fi.balance,
    fi.status,
    fi."transportBilled",
    fi."transportPaid",
    fi."transportBalance",
    fi."sponsorBalance"
  FROM fee_invoices fi
  JOIN learners l ON l.id = fi."learnerId"
  WHERE fi.term = 'TERM_2'
    AND fi."academicYear" = 2026
    AND fi.archived = false
  ORDER BY l."admissionNumber"
) t;
