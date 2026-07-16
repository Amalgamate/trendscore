-- Makes lesson draft creation safe to retry when a browser loses the response
-- after the server has already committed the record.
ALTER TABLE "learning_lessons" ADD COLUMN "requestId" TEXT;

CREATE UNIQUE INDEX "learning_lessons_schoolId_requestId_key"
ON "learning_lessons"("schoolId", "requestId");
