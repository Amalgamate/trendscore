ALTER TABLE "staff_attendance_logs"
ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

CREATE INDEX IF NOT EXISTS "staff_attendance_logs_schoolId_date_idx"
ON "staff_attendance_logs"("schoolId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_attendance_logs_schoolId_fkey'
  ) THEN
    ALTER TABLE "staff_attendance_logs"
    ADD CONSTRAINT "staff_attendance_logs_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
