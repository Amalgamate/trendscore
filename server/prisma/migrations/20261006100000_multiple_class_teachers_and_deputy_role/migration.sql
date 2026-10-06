-- Add a distinct deputy head-teacher role. Multiple staff accounts may hold it.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEPUTY_HEAD_TEACHER';

-- Preserve the existing single-teacher column for compatibility while storing
-- all class-teacher assignments in a join table.
CREATE TABLE "class_teacher_assignments" (
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_teacher_assignments_pkey" PRIMARY KEY ("classId", "teacherId"),
    CONSTRAINT "class_teacher_assignments_classId_fkey"
        FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "class_teacher_assignments_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "class_teacher_assignments_teacherId_idx"
    ON "class_teacher_assignments"("teacherId");

-- Backfill current class teachers without changing their existing assignments.
INSERT INTO "class_teacher_assignments" ("classId", "teacherId")
SELECT "id", "teacherId"
FROM "classes"
WHERE "teacherId" IS NOT NULL
ON CONFLICT ("classId", "teacherId") DO NOTHING;
