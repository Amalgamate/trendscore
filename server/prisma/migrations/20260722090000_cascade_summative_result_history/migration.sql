-- Result history cannot outlive its parent result. Permanent deletion remains
-- restricted to the existing Super Admin paths; this cascade only guarantees
-- referential cleanup once a result is intentionally deleted.
ALTER TABLE "summative_result_history"
  DROP CONSTRAINT "summative_result_history_resultId_fkey";

ALTER TABLE "summative_result_history"
  ADD CONSTRAINT "summative_result_history_resultId_fkey"
  FOREIGN KEY ("resultId") REFERENCES "summative_results"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
