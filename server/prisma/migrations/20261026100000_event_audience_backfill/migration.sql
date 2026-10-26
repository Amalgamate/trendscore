-- Events that were hidden from parents (isParentVisible = false) become staff-only.
-- Empty audience already means "everyone", so visible events need no change.
-- Only rows that have no audience yet are touched, so it is safe to re-run.

UPDATE "events"
SET "audience" = ARRAY['STAFF']::TEXT[]
WHERE "isParentVisible" = false
  AND cardinality("audience") = 0;
