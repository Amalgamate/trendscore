import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const rawTeacherNames = [
  'MR. HUMPHREY MICHENI',
  'MRS. COLLET NERIMA',
  'MR.JEREMIAH ODHIAMBO',
  'MR. JOHN LOKWAWI',
  'MRS. FAITH CHEPKORIR',
  'MR. JUMA LUKAYA',
  'MR. ADAN',
  'MRS. JOLIS KAGENDI',
  'MRS. DORIS MWENDWA',
  'MRS. HELLEN MUKAMI',
  'MRS. NAOMI NKIROTE',
  'MRS. ANN NTINYARI',
  'MRS. EUNICE KANINI',
  'MR. RICHARD BARAZAR',
  'MRS. PAMELLA KARAMBU',
  'MR. ERICK NYANDIKA',
  'MR. ERICK MAKORI',
  'MR. GIFT OCHIENG',
  'MR. EZRA KIRUI',
];

const titleToGender: Record<string, 'MALE' | 'FEMALE' | undefined> = {
  MR: 'MALE',
  MRS: 'FEMALE',
};

function normalizeTeacherName(rawName: string) {
  const normalized = rawName.trim().replace(/\s+/g, ' ').replace(/^MR\./, 'MR. ').replace(/^MRS\./, 'MRS. ');
  const titleMatch = normalized.match(/^(MR|MRS)\.\s*(.+)$/i);
  const title = titleMatch?.[1]?.toUpperCase();
  const name = (titleMatch?.[2] || normalized).trim();
  const parts = name.split(/\s+/);

  return {
    title,
    firstName: parts[0] || 'Teacher',
    lastName: parts.length > 1 ? parts[parts.length - 1] : 'Teacher',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
    gender: title ? titleToGender[title] : undefined,
  };
}

function emailFor(firstName: string, lastName: string) {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${clean(firstName)}.${clean(lastName)}@trendscore.app`;
}

async function main() {
  const password = await bcrypt.hash('Teacher@123!', 10);
  const created: string[] = [];
  const updated: string[] = [];

  for (const rawName of rawTeacherNames) {
    const teacher = normalizeTeacherName(rawName);
    const email = emailFor(teacher.firstName, teacher.lastName);
    const username = email.split('@')[0];

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          {
            role: 'TEACHER',
            firstName: { equals: teacher.firstName, mode: 'insensitive' },
            lastName: { equals: teacher.lastName, mode: 'insensitive' },
            middleName: teacher.middleName
              ? { equals: teacher.middleName, mode: 'insensitive' }
              : null,
          },
        ],
        archived: false,
      },
      select: { id: true, email: true },
    });

    const data = {
      email,
      username,
      password,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      middleName: teacher.middleName,
      gender: teacher.gender as any,
      role: 'TEACHER' as any,
      roles: ['TEACHER'] as any,
      status: 'ACTIVE' as any,
      institutionType: 'PRIMARY_CBC' as any,
      emailVerified: true,
      archived: false,
    };

    if (existing) {
      const updatedUser = await prisma.user.update({
        where: { id: existing.id },
        data,
        select: { firstName: true, lastName: true, email: true },
      });
      updated.push(`${updatedUser.firstName} ${updatedUser.lastName} <${updatedUser.email}>`);
    } else {
      const createdUser = await prisma.user.create({
        data,
        select: { firstName: true, lastName: true, email: true },
      });
      created.push(`${createdUser.firstName} ${createdUser.lastName} <${createdUser.email}>`);
    }
  }

  const teacherCount = await prisma.user.count({
    where: { role: 'TEACHER', archived: false },
  });

  console.log(JSON.stringify({
    input: rawTeacherNames.length,
    created,
    updated,
    activeTeacherCount: teacherCount,
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
