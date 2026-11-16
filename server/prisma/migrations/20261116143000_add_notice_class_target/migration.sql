ALTER TABLE "notices" ADD COLUMN "targetClassId" TEXT;

CREATE INDEX "notices_targetClassId_status_publishedAt_idx"
  ON "notices"("targetClassId", "status", "publishedAt");

ALTER TABLE "notices"
  ADD CONSTRAINT "notices_targetClassId_fkey"
  FOREIGN KEY ("targetClassId") REFERENCES "classes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
