-- Presence events are tenant-scoped. A scan at the same timestamp in two
-- schools must not be treated as a duplicate.
DROP INDEX IF EXISTS "presence_events_dedup_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "presence_events_dedup_idx"
  ON "presence_events"("school_id", "person_id", "event_type", "timestamp")
  WHERE "status" = 'CONFIRMED';
