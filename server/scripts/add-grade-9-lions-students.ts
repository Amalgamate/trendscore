import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const grade = 'GRADE_9';
const preferredStream = 'Lions';
const institutionType = 'PRIMARY_CBC';
const fallbackAcademicYear = 2026;
const fallbackTerm = 'TERM_1';

type StudentInput = {
  fullName: string;
  gender: 'MALE' | 'FEMALE';
};

const students: StudentInput[] = [
  { fullName: 'MOHAMMED ABDIKADIR', gender: 'MALE' },
  { fullName: 'SADDIO SAID', gender: 'MALE' },
  { fullName: 'LEON MUTHOMI', gender: 'MALE' },
  { fullName: 'VICTORIA LOBURA', gender: 'FEMALE' },
  { fullName: 'DAVID GICHOHI', gender: 'MALE' },
  { fullName: 'LEWIS MWIRIGI', gender: 'MALE' },
  { fullName: 'ANWAR SAID', gender: 'MALE' },
  { fullName: 'STACY KENDI', gender: 'FEMALE' },
  { fullName: 'VIOLET LOBURIO', gender: 'FEMALE' },
  { fullName: 'ELIANA TAMIA', gender: 'FEMALE' },
  { fullName: 'KELVIN MURUKI', gender: 'MALE' },
  { fullName: 'ALVIN IRUNGU', gender: 'MALE' },
  { fullName: 'BRIAN MUTMA', gender: 'MALE' },
  { fullName: 'ABDIKADIR MOHAMMED', gender: 'MALE' },
  { fullName: 'MAXWEL MWENDA', gender: 'MALE' },
];

function splitName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts[parts.length - 1] : 'UNKNOWN',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
  };
}

function defaultDobForGrade9() {
  return new Date(`${fallbackAcademicYear - 15}-01-01T00:00:00.000Z`);
}

function normalizeName(value: string | null | undefined) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

async function nextAdmissionNumber(tx: PrismaClient) {
  const sequence = await tx.admissionSequence.upsert({
    where: { academicYear: fallbackAcademicYear },
    update: { currentValue: { increment: 1 } },
    create: { academicYear: fallbackAcademicYear, currentValue: 1 },
  });

  let candidate = String(sequence.currentValue);
  while (await tx.learner.findUnique({ where: { admissionNumber: candidate } })) {
    const bumped = await tx.admissionSequence.update({
      where: { academicYear: fallbackAcademicYear },
      data: { currentValue: { increment: 1 } },
    });
    candidate = String(bumped.currentValue);
  }

  return candidate;
}

async function resolveClass() {
  const activeTerm = await prisma.termConfig.findFirst({
    where: { isActive: true, archived: false },
    select: { academicYear: true, term: true },
  });

  const academicYear = activeTerm?.academicYear ?? fallbackAcademicYear;
  const term = activeTerm?.term ?? fallbackTerm;

  const existingClass = await prisma.class.findFirst({
    where: {
      grade,
      institutionType: institutionType as any,
      academicYear,
      term: term as any,
      archived: false,
      OR: [
        { stream: preferredStream },
        { stream: preferredStream.toUpperCase() },
        { stream: preferredStream.toLowerCase() },
      ],
    },
  });

  if (existingClass) return existingClass;

  await prisma.stream.upsert({
    where: { name: preferredStream },
    update: { active: true, archived: false },
    create: { name: preferredStream, active: true, archived: false },
  });

  return prisma.class.create({
    data: {
      classCode: `CLS-G9-LIONS-${academicYear}-${term}`,
      name: 'Grade 9 Lions',
      grade,
      stream: preferredStream,
      academicYear,
      term: term as any,
      capacity: 60,
      active: true,
      archived: false,
      institutionType: institutionType as any,
    },
  });
}

async function main() {
  const targetClass = await resolveClass();
  const created: string[] = [];
  const updated: string[] = [];
  const enrolled: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const student of students) {
      const names = splitName(student.fullName);
      const existing = await tx.learner.findFirst({
        where: {
          grade,
          archived: false,
          firstName: { equals: names.firstName, mode: 'insensitive' },
          lastName: { equals: names.lastName, mode: 'insensitive' },
          middleName: names.middleName
            ? { equals: names.middleName, mode: 'insensitive' }
            : null,
        },
        select: { id: true, admissionNumber: true },
      });

      const learner = existing
        ? await tx.learner.update({
            where: { id: existing.id },
            data: {
              stream: targetClass.stream,
              status: 'ACTIVE',
              institutionType: institutionType as any,
              updatedAt: new Date(),
            },
            select: { id: true, admissionNumber: true },
          })
        : await tx.learner.create({
            data: {
              admissionNumber: await nextAdmissionNumber(tx as PrismaClient),
              firstName: names.firstName,
              lastName: names.lastName,
              middleName: names.middleName,
              dateOfBirth: defaultDobForGrade9(),
              gender: student.gender as any,
              grade,
              stream: targetClass.stream,
              status: 'ACTIVE',
              admissionDate: new Date(),
              institutionType: institutionType as any,
            },
            select: { id: true, admissionNumber: true },
          });

      await tx.classEnrollment.upsert({
        where: {
          classId_learnerId: {
            classId: targetClass.id,
            learnerId: learner.id,
          },
        },
        update: { active: true, archived: false },
        create: {
          classId: targetClass.id,
          learnerId: learner.id,
          active: true,
          archived: false,
        },
      });

      if (existing) {
        updated.push(`${normalizeName(student.fullName)} (${learner.admissionNumber})`);
      } else {
        created.push(`${normalizeName(student.fullName)} (${learner.admissionNumber})`);
      }
      enrolled.push(normalizeName(student.fullName));
    }
  });

  const count = await prisma.classEnrollment.count({
    where: { classId: targetClass.id, active: true, archived: false },
  });

  console.log(JSON.stringify({
    class: {
      id: targetClass.id,
      name: targetClass.name,
      grade: targetClass.grade,
      stream: targetClass.stream,
      academicYear: targetClass.academicYear,
      term: targetClass.term,
    },
    input: students.length,
    created,
    updated,
    enrolled: enrolled.length,
    activeClassEnrollmentCount: count,
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
