-- Migration: add_timetable_change_requests
-- New model TimetableChangeRequest: lets teachers/tutors submit proposed
-- changes to a published class schedule. Teachers create and view their own
-- requests; EDIT_TIMETABLE roles review them, and an approval applies the
-- change as a ClassSchedule override (reusing the existing override fields).

CREATE TYPE "TimetableChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "timetable_change_requests" (
    "id"            TEXT NOT NULL,
    "classId"       TEXT NOT NULL,
    "day"           TEXT NOT NULL,
    "startTime"     TEXT NOT NULL,
    "endTime"       TEXT NOT NULL,
    "learningAreaId" TEXT,
    "teacherId"     TEXT,
    "requestedById" TEXT NOT NULL,
    "reason"        TEXT NOT NULL,
    "status"        "TimetableChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById"  TEXT,
    "reviewNote"    TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "timetable_change_requests_status_idx" ON "timetable_change_requests"("status");
CREATE INDEX "timetable_change_requests_classId_status_idx" ON "timetable_change_requests"("classId", "status");
CREATE INDEX "timetable_change_requests_requestedById_idx" ON "timetable_change_requests"("requestedById");

DO $$ BEGIN
  ALTER TABLE "timetable_change_requests"
    ADD CONSTRAINT "timetable_change_requests_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_change_requests"
    ADD CONSTRAINT "timetable_change_requests_learningAreaId_fkey"
    FOREIGN KEY ("learningAreaId") REFERENCES "learning_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_change_requests"
    ADD CONSTRAINT "timetable_change_requests_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_change_requests"
    ADD CONSTRAINT "timetable_change_requests_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "timetable_change_requests"
    ADD CONSTRAINT "timetable_change_requests_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
