import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const envFile = process.argv[2] || '.env';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const prisma = new PrismaClient();

const importedStudentNames = [
  'MOHAMMED ABDIKADIR',
  'ABDIRIZAK',
  'MOHAMED ABDIKER',
  'BLESSING WANJA',
];

const importedTeacherEmails = [
  'humphrey.micheni@trendscore.app',
  'collet.nerima@trendscore.app',
  'jeremiah.odhiambo@trendscore.app',
];

async function main() {
  const activeTerm = await prisma.termConfig.findFirst({
    where: { isActive: true, archived: false },
    select: { academicYear: true, term: true },
  });

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, active: true, institutionType: true },
    orderBy: { name: 'asc' },
  });

  const learnersByGrade = await prisma.learner.groupBy({
    by: ['grade'],
    where: { archived: false },
    _count: true,
    orderBy: { grade: 'asc' },
  });

  const classes = await prisma.class.findMany({
    where: {
      archived: false,
      ...(activeTerm ? { academicYear: activeTerm.academicYear, term: activeTerm.term as any } : {}),
      grade: { in: ['PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_9'] },
    },
    select: {
      id: true,
      name: true,
      grade: true,
      stream: true,
      academicYear: true,
      term: true,
      institutionType: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  });

  const matchingStudents = await prisma.learner.findMany({
    where: {
      archived: false,
      OR: importedStudentNames.map((name) => {
        const [firstName, ...rest] = name.split(' ');
        const lastName = rest.length ? rest[rest.length - 1] : 'UNKNOWN';
        return {
          firstName: { equals: firstName, mode: 'insensitive' as const },
          lastName: { equals: lastName, mode: 'insensitive' as const },
        };
      }),
    },
    select: {
      admissionNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      grade: true,
      stream: true,
      institutionType: true,
      enrollments: {
        where: { active: true, archived: false },
        select: {
          class: {
            select: {
              name: true,
              grade: true,
              stream: true,
              academicYear: true,
              term: true,
            },
          },
        },
      },
    },
    orderBy: { admissionNumber: 'asc' },
  });

  const teachers = await prisma.user.findMany({
    where: {
      archived: false,
      OR: [
        { role: 'TEACHER' },
        { email: { in: importedTeacherEmails } },
      ],
    },
    select: { email: true, firstName: true, lastName: true, role: true, roles: true, institutionType: true, status: true },
    orderBy: { email: 'asc' },
  });

  console.log(JSON.stringify({
    envFile,
    activeTerm,
    schools,
    learnersByGrade,
    classes,
    importedStudentMatches: matchingStudents,
    teacherCount: teachers.length,
    importedTeacherMatches: teachers.filter((teacher) => importedTeacherEmails.includes(teacher.email)),
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
