-- reset teacher password for testing
UPDATE users SET password = '$2b$11$4jODHui.GGRotceGCs8ea.pt/9nL.pX2ZOVA3c0ijbscVHOUcNlnq' WHERE email = 'admin2@trendscore.app';

-- find a parent linked to a student
SELECT u.id, u.email, u.role, l.id as learner_id, l."firstName", l."lastName", l.grade, l.stream
FROM users u
JOIN learners l ON l."parentId" = u.id
WHERE u.role = 'PARENT'
LIMIT 5;

-- classes taught by our teacher, or any active class
SELECT id, "classCode", name, grade, stream, "teacherId", "academicYear", term FROM classes WHERE active=true ORDER BY "createdAt" DESC LIMIT 10;

-- active term
SELECT id, "academicYear", term, "isActive" FROM term_configs WHERE "isActive"=true LIMIT 5;

-- learning areas
SELECT id, name, "gradeLevel" FROM learning_areas LIMIT 10;
