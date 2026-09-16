-- TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — post-Phase-8 fix
-- Makes ReportSnapshot idempotent: one row per (learnerId, term, academicYear)
-- instead of one row per view. reportEngine.service.ts's generateReport() was
-- writing a new snapshot on every GET /reports/termly/:learnerId call — since
-- that's the endpoint every report *view* hits, not just an "issue" action,
-- the table would otherwise grow unboundedly and generatedBy would record
-- whoever last *viewed* the report, not whoever generated/issued it.
--
-- Idempotent — safe to re-run. Uses the same IF NOT EXISTS / pg_constraint
-- guard pattern as ereport_engine_manual.sql and ereport_engine_fix_termid.sql
-- so it composes safely with `prisma db execute`.
--
-- Note: this will fail if the table already contains duplicate
-- (learnerId, term, academicYear) rows. Per the codebase's own Phase
-- 3/4/6/7/8 evidence, no school has actually been switched onto the NEW
-- engine with a selected template yet (the seed script hasn't been run), so
-- report_snapshots should currently be empty and this should apply cleanly.
-- If it isn't empty and this fails on a duplicate-key violation, dedupe
-- first (keep the most recent generatedAt per key) before re-running.
--
-- Run with:
--   npx prisma db execute --file prisma\ereport_snapshot_add_unique.sql --schema prisma\schema.prisma

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'report_snapshots_learnerId_term_academicYear_key'
  ) THEN
    ALTER TABLE "report_snapshots"
      ADD CONSTRAINT "report_snapshots_learnerId_term_academicYear_key"
      UNIQUE ("learnerId", "term", "academicYear");
  END IF;
END $$;

-- The old, non-unique lookup index (learnerId, term, academicYear) — if it
-- exists from the original Phase 2/3 migration — is now redundant, since a
-- unique constraint creates its own backing index over the same columns.
-- Drop it only if present, to avoid maintaining two identical indexes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'report_snapshots_learnerId_term_academicYear_idx'
  ) THEN
    DROP INDEX "report_snapshots_learnerId_term_academicYear_idx";
  END IF;
END $$;
