import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const envFile = process.argv[2] || '.env.production';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const prisma = new PrismaClient();

async function main() {
  const learnerColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'learners'
      AND column_name IN ('schoolId', 'branchId')
    ORDER BY column_name
  `);

  const userColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('schoolId', 'branchId')
    ORDER BY column_name
  `);

  const classColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name IN ('schoolId', 'branchId')
    ORDER BY column_name
  `);

  const visibleGrade1Scope = await prisma.$queryRawUnsafe(`
    SELECT "schoolId", "branchId", COUNT(*)::int AS count
    FROM learners
    WHERE grade = 'GRADE_1' AND archived = false
    GROUP BY "schoolId", "branchId"
    ORDER BY count DESC
  `);

  const importedScope = await prisma.$queryRawUnsafe(`
    SELECT grade, "schoolId", "branchId", COUNT(*)::int AS count
    FROM learners
    WHERE "admissionNumber" IN (
      '1043', '1061', '1083', '1104'
    )
    GROUP BY grade, "schoolId", "branchId"
    ORDER BY grade
  `);

  const teacherScope = await prisma.$queryRawUnsafe(`
    SELECT role, "schoolId", "branchId", COUNT(*)::int AS count
    FROM users
    WHERE archived = false AND role = 'TEACHER'
    GROUP BY role, "schoolId", "branchId"
    ORDER BY count DESC
  `);

  console.log(JSON.stringify({
    envFile,
    learnerScopeColumns: learnerColumns.map((column) => column.column_name),
    userScopeColumns: userColumns.map((column) => column.column_name),
    classScopeColumns: classColumns.map((column) => column.column_name),
    visibleGrade1Scope,
    importedScope,
    teacherScope,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
