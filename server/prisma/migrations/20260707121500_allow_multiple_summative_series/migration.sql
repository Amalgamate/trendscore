-- Allow schools to create multiple exam series for the same grade, subject,
-- term, year, and test type. The old unique index ignored title, so a second
-- Mock/CAT/etc. series failed even when the series name was different.

DROP INDEX IF EXISTS "summative_tests_grade_learningArea_term_academicYear_testTy_key";

CREATE UNIQUE INDEX IF NOT EXISTS "summative_tests_series_unique_key"
  ON "summative_tests"("grade", "learningArea", "term", "academicYear", "testType", "title");
