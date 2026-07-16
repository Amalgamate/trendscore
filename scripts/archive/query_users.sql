SELECT id, email, role, "firstName", "lastName" FROM users WHERE role IN ('TEACHER','STUDENT','PARENT','ADMIN') AND archived=false ORDER BY role LIMIT 20;
