ALTER TABLE "conversation_participants"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "pinnedAt" TIMESTAMP(3);

ALTER TABLE "message_receipts"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "conversation_participants_userId_archivedAt_idx"
  ON "conversation_participants"("userId", "archivedAt");

CREATE INDEX "message_receipts_recipientId_archivedAt_idx"
  ON "message_receipts"("recipientId", "archivedAt");
