-- "Skip pickup": an explicit, driver-confirmed statement that a learner was NOT
-- collected on a given run.
--
-- Deliberately separate from transport_boarding_events. A missing boarding row
-- is ambiguous (the driver may have forgotten); this is a deliberate record.
-- That difference is what makes it reportable and what triggers the guardian
-- alert, so the distinction has to survive in the data model.
--
-- Snake_case to match transport_trips / transport_boarding_events.

CREATE TABLE IF NOT EXISTS "transport_no_shows" (
  "id"                    TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "trip_id"               TEXT        NOT NULL,
  "learner_id"            TEXT        NOT NULL,
  -- NO_ANSWER | REFUSED | ABSENT | ALREADY_COLLECTED | LATE | OTHER
  "reason"                TEXT        NOT NULL DEFAULT 'NO_ANSWER',
  "note"                  TEXT,
  "reported_by"           TEXT,
  "reported_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Separate from creation so a failed SMS can be retried without the driver
  -- having to report the skip a second time.
  "guardian_notified_at"  TIMESTAMP(3),
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_no_shows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_no_shows_trip_fkey"
    FOREIGN KEY ("trip_id") REFERENCES "transport_trips"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_no_shows_learner_fkey"
    FOREIGN KEY ("learner_id") REFERENCES "learners"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- One confirmed skip per learner per run: re-reporting updates in place
  -- instead of alerting the guardian twice.
  CONSTRAINT "transport_no_shows_trip_learner_unique" UNIQUE ("trip_id", "learner_id")
);

CREATE INDEX IF NOT EXISTS "transport_no_shows_learner_reported_at_idx"
  ON "transport_no_shows"("learner_id", "reported_at");

CREATE INDEX IF NOT EXISTS "transport_no_shows_trip_id_idx"
  ON "transport_no_shows"("trip_id");