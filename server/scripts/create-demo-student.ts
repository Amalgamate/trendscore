import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/config/database';
import { generateAdmissionNumber } from '../src/services/admissionNumber.service';
import { FeeService } from '../src/services/fee.service';
import { Term, FeeCategory } from '@prisma/client';

process.env.SKIP_FEE_NOTIFICATIONS = 'true';

async function ensureAdminUser() {
  const email = 'demo-admin@trendscore.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const password = await bcrypt.hash('DemoAdmin123!', 12);
  return prisma.user.create({
    data: {
      email,
      password,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  });
}

/** Matches `scripts/seed-demo-users.mjs` (parent@demo.trendscore / Demo@2025!). Override with env if needed. */
const DEMO_PARENT_EMAIL = process.env.DEMO_PARENT_EMAIL ?? 'parent@demo.trendscore';
const DEMO_PARENT_PHONE = process.env.DEMO_PARENT_PHONE ?? '+254700000003';
const DEMO_PARENT_PASSWORD = process.env.DEMO_PARENT_PASSWORD ?? 'Demo@2025!';

async function ensureDemoParentUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_PARENT_EMAIL } });
  if (existing) {
    if (existing.role !== 'PARENT') {
      throw new Error(`User ${DEMO_PARENT_EMAIL} exists but role is ${existing.role}, expected PARENT`);
    }
    return existing;
  }

  const password = await bcrypt.hash(DEMO_PARENT_PASSWORD, 12);
  return prisma.user.create({
    data: {
      email: DEMO_PARENT_EMAIL,
      password,
      firstName: 'Demo',
      lastName: 'Parent',
      phone: DEMO_PARENT_PHONE,
      role: 'PARENT',
      status: 'ACTIVE',
      emailVerified: true
    }
  });
}

const DEFAULT_FEE_TYPES: Array<{ code: string; name: string; category: FeeCategory; description: string }> = [
  { code: 'TUITION', name: 'Tuition', category: 'ACADEMIC', description: 'School tuition fees' },
  { code: 'ACTIVITY', name: 'Activity Fee', category: 'EXTRA_CURRICULAR', description: 'Co-curricular activities' },
  { code: 'TRANSPORT', name: 'Transport', category: 'TRANSPORT', description: 'School transport' },
  { code: 'MEALS', name: 'Meals', category: 'BOARDING', description: 'School meals and catering' },
  { code: 'EXAM', name: 'Examination Fee', category: 'ACADEMIC', description: 'Examination fees' },
  { code: 'LIBRARY', name: 'Library', category: 'ACADEMIC', description: 'Library resources and materials' },
  { code: 'SPORTS', name: 'Sports Fee', category: 'EXTRA_CURRICULAR', description: 'Sports programs and facilities' },
  { code: 'TECHNOLOGY', name: 'Technology Fee', category: 'ACADEMIC', description: 'Computer lab and tech resources' },
  { code: 'MISC', name: 'Miscellaneous', category: 'OTHER', description: 'Other school charges' }
];

const GRADE: string = 'GRADE_1';
const TERM: Term = 'TERM_1';

function gradeAmounts(grade: string) {
  return {
    TUITION: 20000,
    ACTIVITY: 800,
    TRANSPORT: 4000,
    MEALS: 10000,
    EXAM: 500,
    LIBRARY: 800,
    SPORTS: 1000,
    TECHNOLOGY: 1500,
    MISC: 800
  } as Record<string, number>;
}

async function ensureFeeTypes() {
  for (const feeType of DEFAULT_FEE_TYPES) {
    await prisma.feeType.upsert({
      where: { code: feeType.code },
      update: {
        name: feeType.name,
        category: feeType.category,
        description: feeType.description,
        isActive: true
      },
      create: {
        code: feeType.code,
        name: feeType.name,
        category: feeType.category,
        description: feeType.description,
        isActive: true
      }
    });
  }
}

async function ensureActiveTermConfig(adminId: string) {
  const currentYear = new Date().getFullYear();
  const existing = await prisma.termConfig.findFirst({
    where: {
      academicYear: currentYear,
      term: TERM,
      isActive: true
    }
  });

  if (existing) return existing;

  const startDate = new Date(currentYear, 0, 1);
  const endDate = new Date(currentYear, 3, 30);

  return prisma.termConfig.upsert({
    where: {
      academicYear_term: {
        academicYear: currentYear,
        term: TERM
      }
    },
    update: {
      startDate,
      endDate,
      formativeWeight: 30,
      summativeWeight: 70,
      isActive: true,
      isClosed: false,
      createdBy: adminId
    },
    create: {
      academicYear: currentYear,
      term: TERM,
      startDate,
      endDate,
      formativeWeight: 30,
      summativeWeight: 70,
      isActive: true,
      isClosed: false,
      createdBy: adminId
    }
  });
}

async function ensureFeeStructure() {
  const currentYear = new Date().getFullYear();
  const existing = await prisma.feeStructure.findFirst({
    where: {
      grade: 'GRADE_1',
      term: TERM,
      academicYear: currentYear,
      active: true
    },
    include: { feeItems: true }
  });

  const feeTypes = await prisma.feeType.findMany();
  const feeStructure = existing
    ? existing
    : await prisma.feeStructure.create({
        data: {
          name: `Grade 1 ${TERM.replace('_', ' ')} Fees ${currentYear}`,
          description: `Default fee structure for Grade 1 ${TERM.replace('_', ' ')}`,
          grade: 'GRADE_1',
          term: TERM,
          academicYear: currentYear,
          mandatory: true,
          active: true
        }
      });

  const amounts = gradeAmounts(GRADE);
  if (!existing || existing.feeItems.length === 0) {
    for (const feeType of feeTypes) {
      const amount = amounts[feeType.code] || 0;
      if (amount <= 0) continue;

      await prisma.feeStructureItem.create({
        data: {
          feeStructureId: feeStructure.id,
          feeTypeId: feeType.id,
          amount: amount.toString(),
          mandatory: true
        }
      });
    }
  }

  return feeStructure;
}

async function main() {
  try {
    const admin = await ensureAdminUser();
    await ensureFeeTypes();
    await ensureActiveTermConfig(admin.id);
    await ensureFeeStructure();

    const parent = await ensureDemoParentUser();
    const guardianName = `${parent.firstName} ${parent.lastName}`.trim();
    const guardianPhone = parent.phone ?? DEMO_PARENT_PHONE;
    const guardianEmail = parent.email;

    const admissionNumber = await generateAdmissionNumber('A', new Date().getFullYear());
    const learner = await prisma.learner.create({
      data: {
        admissionNumber,
        firstName: 'Demo',
        lastName: 'Learner',
        middleName: 'Test',
        dateOfBirth: new Date('2014-01-01'),
        gender: 'MALE',
        grade: GRADE,
        stream: 'A',
        parentId: parent.id,
        guardianName,
        guardianPhone,
        guardianEmail,
        status: 'ACTIVE',
        createdBy: admin.id
      }
    });

    console.log('Created learner:', learner.id, learner.admissionNumber);

    const feeService = new FeeService();
    const invoiceResult = await feeService.generateInvoiceForLearner(learner.id);
    console.log('Invoice generation result:', invoiceResult);

    console.log('Done. Student created with invoice flow executed.');
    console.log(`Linked to parent: ${guardianEmail} (${guardianName})`);
  } catch (error) {
    console.error('Failed to create demo student:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
