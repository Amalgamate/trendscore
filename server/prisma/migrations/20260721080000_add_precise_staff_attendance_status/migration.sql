CREATE TYPE "StaffAttendanceStatus" AS ENUM (
  'PRESENT',
  'ABSENT',
  'LATE',
  'ON_LEAVE',
  'OFF_DUTY',
  'HOLIDAY',
  'PARTIAL'
);

ALTER TABLE "staff_attendance_logs"
  ADD COLUMN "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  ADD COLUMN "markedBy" TEXT,
  ADD COLUMN "markingReason" TEXT,
  ADD COLUMN "correctedAt" TIMESTAMP(3),
  ALTER COLUMN "clockInAt" DROP NOT NULL;

ALTER TABLE "schools"
  ADD COLUMN "staffWorkStartTime" TEXT NOT NULL DEFAULT '07:30',
  ADD COLUMN "staffWorkEndTime" TEXT NOT NULL DEFAULT '16:30',
  ADD COLUMN "staffRequiredMinutes" INTEGER NOT NULL DEFAULT 480,
  ADD COLUMN "staffPartialDayMinutes" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "staffWorkingDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]';

CREATE TABLE "staff_attendance_corrections" (
  "id" TEXT NOT NULL,
  "attendanceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "previousStatus" "StaffAttendanceStatus",
  "newStatus" "StaffAttendanceStatus" NOT NULL,
  "previousClockInAt" TIMESTAMP(3),
  "previousClockOutAt" TIMESTAMP(3),
  "newClockInAt" TIMESTAMP(3),
  "newClockOutAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "correctedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendance_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_attendance_corrections_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "staff_attendance_logs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "staff_attendance_corrections_attendanceId_createdAt_idx"
  ON "staff_attendance_corrections"("attendanceId", "createdAt");

CREATE INDEX "staff_attendance_corrections_userId_date_idx"
  ON "staff_attendance_corrections"("userId", "date");

CREATE INDEX "staff_attendance_logs_status_date_idx"
  ON "staff_attendance_logs"("status", "date");
