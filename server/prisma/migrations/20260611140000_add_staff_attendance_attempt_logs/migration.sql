DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffAttendanceAttemptAction') THEN
    CREATE TYPE "StaffAttendanceAttemptAction" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffAttendanceAttemptResult') THEN
    CREATE TYPE "StaffAttendanceAttemptResult" AS ENUM ('ALLOWED', 'DENIED');
  END IF;
END $$;

CREATE TABLE "staff_attendance_attempt_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "action" "StaffAttendanceAttemptAction" NOT NULL,
    "result" "StaffAttendanceAttemptResult" NOT NULL,
    "reasonCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "radiusMeters" INTEGER NOT NULL,
    "enforcementMode" "GeofenceEnforcementMode" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_attendance_attempt_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_attendance_attempt_logs_userId_createdAt_idx" ON "staff_attendance_attempt_logs"("userId", "createdAt");
CREATE INDEX "staff_attendance_attempt_logs_schoolId_createdAt_idx" ON "staff_attendance_attempt_logs"("schoolId", "createdAt");

ALTER TABLE "staff_attendance_attempt_logs" ADD CONSTRAINT "staff_attendance_attempt_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_attendance_attempt_logs" ADD CONSTRAINT "staff_attendance_attempt_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
