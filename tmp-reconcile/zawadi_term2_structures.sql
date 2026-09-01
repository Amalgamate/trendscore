SELECT json_agg(row_to_json(t))
FROM (
  SELECT
    fs.id,
    fs.name,
    fs.grade,
    fs.term,
    fs."academicYear",
    fs.active,
    COALESCE(SUM(fsi.amount), 0) AS amount
  FROM fee_structures fs
  LEFT JOIN fee_structure_items fsi ON fsi."feeStructureId" = fs.id
  WHERE fs.term = 'TERM_2'
    AND fs."academicYear" = 2026
    AND fs.active = true
    AND fs.archived = false
  GROUP BY fs.id
  ORDER BY fs.grade
) t;
