-- Timetable Engine Foundation
-- Existing class_schedules remain the published compatibility/read model.

CREATE TYPE "TimetablePeriodType" AS ENUM ('LESSON', 'BREAK', 'LUNCH', 'ASSEMBLY', 'PRAYER', 'CLUBS', 'GAMES', 'GUIDANCE', 'EXAMINATION', 'OTHER');
CREATE TYPE "TimetableLessonType" AS ENUM ('NORMAL', 'DOUBLE', 'TRIPLE', 'PRACTICAL', 'LABORATORY', 'COMPUTER_LAB', 'GAMES', 'ASSEMBLY', 'CLUBS', 'GUIDANCE', 'PRAYER', 'LIBRARY', 'EXAMINATION');
CREATE TYPE "TimetableRoomType" AS ENUM ('CLASSROOM', 'SCIENCE_LAB', 'ICT_LAB', 'LIBRARY', 'MUSIC_ROOM', 'ART_ROOM', 'WORKSHOP', 'AGRICULTURE_FIELD', 'SWIMMING_POOL', 'MULTIPURPOSE_HALL', 'SPORTS_GROUND', 'OTHER');
CREATE TYPE "TimetablePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "TimetableVersionStatus" AS ENUM ('DRAFT', 'GENERATED', 'DEPARTMENT_REVIEW', 'DEPUTY_REVIEW', 'PRINCIPAL_REVIEW', 'APPROVED', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

CREATE TABLE "bell_schedules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bell_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bell_periods" (
  "id" TEXT NOT NULL,
  "bellScheduleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "type" "TimetablePeriodType" NOT NULL DEFAULT 'LESSON',
  "instructional" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bell_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timetable_plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "academicYear" INTEGER NOT NULL,
  "term" "Term" NOT NULL,
  "bellScheduleId" TEXT NOT NULL,
  "status" "TimetablePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timetable_versions" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "TimetableVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "changeNote" TEXT,
  "createdById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timetable_rooms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "type" "TimetableRoomType" NOT NULL DEFAULT 'CLASSROOM',
  "capacity" INTEGER,
  "building" TEXT,
  "floor" TEXT,
  "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teacher_availability" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teacher_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_availability" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "room_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instructional_allocations" (
  "id" TEXT NOT NULL,
  "academicYear" INTEGER NOT NULL,
  "grade" TEXT NOT NULL,
  "learningAreaId" TEXT NOT NULL,
  "minimumWeeklyPeriods" INTEGER NOT NULL DEFAULT 0,
  "targetWeeklyPeriods" INTEGER NOT NULL,
  "maximumWeeklyPeriods" INTEGER,
  "preferredDuration" INTEGER,
  "requiresDouble" BOOLEAN NOT NULL DEFAULT false,
  "requiredRoomType" "TimetableRoomType",
  "sourceReference" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instructional_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timetable_entries" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "learningAreaId" TEXT NOT NULL,
  "teacherId" TEXT,
  "roomId" TEXT,
  "bellPeriodId" TEXT,
  "day" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "lessonType" "TimetableLessonType" NOT NULL DEFAULT 'NORMAL',
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bell_schedules_name_key" ON "bell_schedules"("name");
CREATE INDEX "bell_schedules_active_idx" ON "bell_schedules"("active");
CREATE UNIQUE INDEX "bell_periods_bellScheduleId_sequence_key" ON "bell_periods"("bellScheduleId", "sequence");
CREATE UNIQUE INDEX "bell_periods_bellScheduleId_startTime_endTime_key" ON "bell_periods"("bellScheduleId", "startTime", "endTime");
CREATE INDEX "bell_periods_bellScheduleId_active_idx" ON "bell_periods"("bellScheduleId", "active");
CREATE UNIQUE INDEX "timetable_plans_name_academicYear_term_key" ON "timetable_plans"("name", "academicYear", "term");
CREATE INDEX "timetable_plans_academicYear_term_status_idx" ON "timetable_plans"("academicYear", "term", "status");
CREATE UNIQUE INDEX "timetable_versions_planId_version_key" ON "timetable_versions"("planId", "version");
CREATE INDEX "timetable_versions_planId_status_idx" ON "timetable_versions"("planId", "status");
CREATE UNIQUE INDEX "timetable_rooms_name_key" ON "timetable_rooms"("name");
CREATE UNIQUE INDEX "timetable_rooms_code_key" ON "timetable_rooms"("code");
CREATE INDEX "timetable_rooms_type_active_idx" ON "timetable_rooms"("type", "active");
CREATE UNIQUE INDEX "teacher_availability_teacherId_day_startTime_endTime_key" ON "teacher_availability"("teacherId", "day", "startTime", "endTime");
CREATE INDEX "teacher_availability_teacherId_day_idx" ON "teacher_availability"("teacherId", "day");
CREATE UNIQUE INDEX "room_availability_roomId_day_startTime_endTime_key" ON "room_availability"("roomId", "day", "startTime", "endTime");
CREATE INDEX "room_availability_roomId_day_idx" ON "room_availability"("roomId", "day");
CREATE UNIQUE INDEX "instructional_allocations_academicYear_grade_learningAreaId_key" ON "instructional_allocations"("academicYear", "grade", "learningAreaId");
CREATE INDEX "instructional_allocations_grade_academicYear_active_idx" ON "instructional_allocations"("grade", "academicYear", "active");
CREATE UNIQUE INDEX "timetable_entries_versionId_classId_day_startTime_endTime_key" ON "timetable_entries"("versionId", "classId", "day", "startTime", "endTime");
CREATE INDEX "timetable_entries_versionId_day_startTime_idx" ON "timetable_entries"("versionId", "day", "startTime");
CREATE INDEX "timetable_entries_teacherId_day_startTime_idx" ON "timetable_entries"("teacherId", "day", "startTime");
CREATE INDEX "timetable_entries_roomId_day_startTime_idx" ON "timetable_entries"("roomId", "day", "startTime");
CREATE INDEX "timetable_entries_classId_day_startTime_idx" ON "timetable_entries"("classId", "day", "startTime");

ALTER TABLE "bell_periods" ADD CONSTRAINT "bell_periods_bellScheduleId_fkey" FOREIGN KEY ("bellScheduleId") REFERENCES "bell_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_plans" ADD CONSTRAINT "timetable_plans_bellScheduleId_fkey" FOREIGN KEY ("bellScheduleId") REFERENCES "bell_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "timetable_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instructional_allocations" ADD CONSTRAINT "instructional_allocations_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "learning_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "timetable_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "learning_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "timetable_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_bellPeriodId_fkey" FOREIGN KEY ("bellPeriodId") REFERENCES "bell_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
