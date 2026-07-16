SELECT count(*) as class_count FROM classes;
SELECT count(*) as enrollment_count FROM class_enrollments;
SELECT count(*) as learner_count FROM learners;
SELECT count(*) as parent_count FROM users WHERE role='PARENT';
SELECT id, "firstName","lastName","parentId", grade, stream FROM learners LIMIT 15;
