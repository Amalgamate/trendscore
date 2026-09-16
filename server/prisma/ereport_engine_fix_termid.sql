-- Correction to report_snapshots (Phase 4 catch, still zero rows so safe to alter):
-- The rest of the codebase identifies a term by (term enum, academicYear int),
-- never a single termId string (see TermlyReportComment, SummativeTest, etc.).
-- ReportSnapshot's design should match that convention, not invent a new one.

ALTER TABLE "report_snapshots" DROP COLUMN IF EXISTS "termId";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_snapshots' AND column_name = 'term'
  ) THEN
    ALTER TABLE "report_snapshots" ADD COLUMN "term" "Term" NOT NULL DEFAULT 'TERM_1';
    ALTER TABLE "report_snapshots" ALTER COLUMN "term" DROP DEFAULT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_snapshots' AND column_name = 'academicYear'
  ) THEN
    ALTER TABLE "report_snapshots" ADD COLUMN "academicYear" INTEGER NOT NULL DEFAULT 2026;
    ALTER TABLE "report_snapshots" ALTER COLUMN "academicYear" DROP DEFAULT;
  END IF;
END $$;

DROP INDEX IF EXISTS "report_snapshots_learnerId_termId_idx";
CREATE INDEX IF NOT EXISTS "report_snapshots_learnerId_term_academicYear_idx" ON "report_snapshots"("learnerId", "term", "academicYear");
