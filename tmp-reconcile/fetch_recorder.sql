SELECT json_agg(row_to_json(t))
FROM (
  SELECT id, email, username, role
  FROM users
  WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'
  ORDER BY "createdAt" ASC
  LIMIT 3
) t;
