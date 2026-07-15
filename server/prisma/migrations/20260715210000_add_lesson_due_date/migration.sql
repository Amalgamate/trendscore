-- Lessons may be saved as drafts without a due date, but a due date is
-- required before publishing so learners have a clear completion deadline.
ALTER TABLE "learning_lessons" ADD COLUMN "dueDate" TIMESTAMP(3);

CREATE INDEX "learning_lessons_dueDate_idx" ON "learning_lessons"("dueDate");
