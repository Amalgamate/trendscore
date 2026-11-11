ALTER TABLE "bank_statement_lines"
  ADD COLUMN "matchType" TEXT,
  ADD COLUMN "matchedId" TEXT,
  ADD COLUMN "reconciledById" TEXT,
  ADD COLUMN "reconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationNote" TEXT;

CREATE UNIQUE INDEX "bank_statement_lines_matchType_matchedId_key"
  ON "bank_statement_lines"("matchType", "matchedId");

CREATE TABLE "bank_statement_match_events" (
  "id" TEXT NOT NULL,
  "statementLineId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "matchType" TEXT,
  "matchedId" TEXT,
  "actorId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_match_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_statement_match_events_statementLineId_fkey"
    FOREIGN KEY ("statementLineId") REFERENCES "bank_statement_lines"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "bank_statement_match_events_statementLineId_createdAt_idx"
  ON "bank_statement_match_events"("statementLineId", "createdAt");

-- Older lines linked through journalItemId can retain their known target.
-- Original actor and action timestamps were not recorded, so those fields
-- remain null and the event explicitly identifies this as a backfill.
UPDATE "bank_statement_lines"
SET "matchType" = 'JOURNAL_ITEM', "matchedId" = "journalItemId"
WHERE "status" = 'RECONCILED' AND "journalItemId" IS NOT NULL;

INSERT INTO "bank_statement_match_events"
  ("id", "statementLineId", "action", "matchType", "matchedId", "note", "createdAt")
SELECT gen_random_uuid()::text, "id", 'MATCH', 'JOURNAL_ITEM', "journalItemId",
       'Historical journalItemId link migrated; original actor and match time were not recorded.', CURRENT_TIMESTAMP
FROM "bank_statement_lines"
WHERE "status" = 'RECONCILED' AND "journalItemId" IS NOT NULL;

-- Historical reconciled rows with no journalItemId remain RECONCILED for
-- reporting, but cannot be undone automatically because their target is unknown.
UPDATE "bank_statement_lines"
SET "reconciliationNote" = 'Historical reconciliation; matched target was not recorded.'
WHERE "status" = 'RECONCILED' AND "journalItemId" IS NULL;
