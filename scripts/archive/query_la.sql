SELECT id, name, "gradeLevel" FROM learning_areas WHERE "gradeLevel" IN ('GRADE_7','Grade 7') OR name ILIKE '%math%' LIMIT 10;
