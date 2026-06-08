import {
  AssessmentStatus,
  AttendanceStatus,
  FeeCategory,
  FormativeAssessmentType,
  Gender,
  Grade,
  PaymentStatus,
  PrismaClient,
  RubricRating,
  Term,
  TestStatus,
  UserRole
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const YEAR = 2025;
const TERM = Term.TERM_1;

const GRADE_LABELS: Record<string, string> = {
  PLAYGROUP: 'Play Group', PLAY_GROUP: 'Play Group',
  PP1: 'PP 1', PP2: 'PP 2',
  GRADE_1: 'Grade 1', GRADE_2: 'Grade 2', GRADE_3: 'Grade 3',
  GRADE_4: 'Grade 4', GRADE_5: 'Grade 5', GRADE_6: 'Grade 6',
  GRADE_7: 'Grade 7', GRADE_8: 'Grade 8', GRADE_9: 'Grade 9',
};

async function ensureParent() {
  const email = 'mary.wanjiku.parent@local.test';
  const existing = await prisma.user.findUnique({ where: { email } });
  const hashedPassword = await bcrypt.hash('Parent123!', 10);

  if (existing) {
    return prisma.user.update({
      where: { email },
      data: {
        firstName: 'Mary',
        lastName: 'Wanjiku',
        role: UserRole.PARENT,
        password: hashedPassword,
        institutionType: 'PRIMARY_CBC',
        status: 'ACTIVE',
        emailVerified: true
      }
    });
  }

  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: 'Mary',
      lastName: 'Wanjiku',
      role: UserRole.PARENT,
      phone: '+254700123456',
      institutionType: 'PRIMARY_CBC',
      status: 'ACTIVE',
      emailVerified: true
    }
  });
}

async function ensureTeacher() {
  const existing = await prisma.user.findFirst({
    where: {
      role: { in: [UserRole.TEACHER, UserRole.ADMIN, UserRole.HEAD_TEACHER] },
      archived: false
    }
  });
  if (existing) return existing;

  const hashedPassword = await bcrypt.hash('Teacher123!', 10);
  return prisma.user.create({
    data: {
      email: 'teacher.dashboard@local.test',
      password: hashedPassword,
      firstName: 'Grace',
      lastName: 'Njeri',
      role: UserRole.TEACHER,
      phone: '+254711000000',
      institutionType: 'PRIMARY_CBC',
      status: 'ACTIVE',
      emailVerified: true
    }
  });
}

async function ensureLearner(parentId: string, data: {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  grade: Grade;
  stream: string;
  gender: Gender;
}) {
  const existing = await prisma.learner.findUnique({ where: { admissionNumber: data.admissionNumber } });
  const common = {
    firstName: data.firstName,
    lastName: data.lastName,
    grade: data.grade,
    stream: data.stream,
    parentId,
    institutionType: 'PRIMARY_CBC' as const,
    status: 'ACTIVE' as const,
    dateOfBirth: new Date('2015-02-14'),
    gender: data.gender
  };

  if (existing) {
    return prisma.learner.update({
      where: { admissionNumber: data.admissionNumber },
      data: common
    });
  }

  return prisma.learner.create({
    data: {
      admissionNumber: data.admissionNumber,
      ...common
    }
  });
}

async function ensureAttendance(learnerId: string, markedBy: string, presentDays: number, absentDays: number) {
  const days: AttendanceStatus[] = [];
  for (let i = 0; i < presentDays; i++) days.push(AttendanceStatus.PRESENT);
  for (let i = 0; i < absentDays; i++) days.push(AttendanceStatus.ABSENT);

  const today = new Date();
  for (let i = 0; i < days.length; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);

    await prisma.attendance.upsert({
      where: { learnerId_date: { learnerId, date: d } },
      update: { status: days[i], markedBy, archived: false },
      create: {
        learnerId,
        date: d,
        status: days[i],
        markedBy
      }
    });
  }
}

async function ensureAssessmentData(learnerId: string, teacherId: string, grade: Grade, subjects: Array<{ name: string; marks: number; grade: string }>, homeworkCount: number) {
  for (const subject of subjects) {
    const title = `${subject.name} End Term`;
    const existingTest = await prisma.summativeTest.findFirst({
      where: { title, grade, term: TERM, academicYear: YEAR, archived: false },
      orderBy: { createdAt: 'desc' }
    });

    const test = existingTest
      ? await prisma.summativeTest.update({
          where: { id: existingTest.id },
          data: {
            learningArea: subject.name,
            createdBy: teacherId,
            status: AssessmentStatus.PUBLISHED,
            published: true,
            archived: false
          }
        })
      : await prisma.summativeTest.create({
          data: {
            title,
            learningArea: subject.name,
            term: TERM,
            academicYear: YEAR,
            grade,
            testDate: new Date('2025-04-15'),
            totalMarks: 100,
            passMarks: 40,
            createdBy: teacherId,
            status: AssessmentStatus.PUBLISHED,
            published: true
          }
        });

    await prisma.summativeResult.upsert({
      where: {
        testId_learnerId: {
          testId: test.id,
          learnerId
        }
      },
      update: {
        marksObtained: subject.marks,
        percentage: subject.marks,
        grade: subject.grade,
        status: subject.marks >= 40 ? TestStatus.PASS : TestStatus.FAIL,
        recordedBy: teacherId,
        archived: false
      },
      create: {
        testId: test.id,
        learnerId,
        marksObtained: subject.marks,
        percentage: subject.marks,
        grade: subject.grade,
        status: subject.marks >= 40 ? TestStatus.PASS : TestStatus.FAIL,
        recordedBy: teacherId
      }
    });
  }

  for (let i = 0; i < homeworkCount; i++) {
    const title = `Homework ${i + 1}`;
    await prisma.formativeAssessment.upsert({
      where: {
        learnerId_term_academicYear_learningArea_type_title: {
          learnerId,
          term: TERM,
          academicYear: YEAR,
          learningArea: 'Mathematics',
          type: FormativeAssessmentType.ASSIGNMENT,
          title
        }
      },
      update: {
        overallRating: RubricRating.ME,
        teacherId,
        status: AssessmentStatus.PUBLISHED,
        archived: false
      },
      create: {
        learnerId,
        term: TERM,
        academicYear: YEAR,
        learningArea: 'Mathematics',
        overallRating: RubricRating.ME,
        teacherId,
        type: FormativeAssessmentType.ASSIGNMENT,
        status: AssessmentStatus.PUBLISHED,
        title
      }
    });
  }
}

async function ensureInvoices(learnerId: string, issuedBy: string, amount: number, invoiceNumber: string, grade: Grade) {
  const feeType = await prisma.feeType.upsert({
    where: { code: 'TUITION' },
    update: { name: 'Tuition Fee', category: FeeCategory.ACADEMIC, isActive: true },
    create: { code: 'TUITION', name: 'Tuition Fee', category: FeeCategory.ACADEMIC, isActive: true }
  });

  const structure = await prisma.feeStructure.upsert({
    where: {
      grade_term_academicYear: {
        grade,
        term: TERM,
        academicYear: YEAR
      }
    },
    update: {
      name: GRADE_LABELS[String(grade).toUpperCase().replace(/\s+/g,'_')] ?? String(grade).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
      active: true,
      archived: false
    },
    create: {
      name: GRADE_LABELS[String(grade).toUpperCase().replace(/\s+/g,'_')] ?? String(grade).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
      description: 'Demo fee structure for parent dashboard preview',
      grade,
      term: TERM,
      academicYear: YEAR,
      active: true
    }
  });

  const existingItem = await prisma.feeStructureItem.findFirst({
    where: { feeStructureId: structure.id, feeTypeId: feeType.id }
  });
  if (existingItem) {
    await prisma.feeStructureItem.update({
      where: { id: existingItem.id },
      data: { amount }
    });
  } else {
    await prisma.feeStructureItem.create({
      data: {
        feeStructureId: structure.id,
        feeTypeId: feeType.id,
        amount
      }
    });
  }

  await prisma.feeInvoice.upsert({
    where: { invoiceNumber },
    update: {
      learnerId,
      feeStructureId: structure.id,
      term: TERM,
      academicYear: YEAR,
      dueDate: new Date('2025-04-30'),
      totalAmount: amount,
      paidAmount: 0,
      balance: amount,
      status: PaymentStatus.PENDING,
      issuedBy,
      archived: false
    },
    create: {
      invoiceNumber,
      learnerId,
      feeStructureId: structure.id,
      term: TERM,
      academicYear: YEAR,
      dueDate: new Date('2025-04-30'),
      totalAmount: amount,
      paidAmount: 0,
      balance: amount,
      status: PaymentStatus.PENDING,
      issuedBy
    }
  });
}

async function ensureNotices(createdById: string) {
  const notices = [
    {
      title: 'School closed on Friday',
      content: 'Public Holiday',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    },
    {
      title: 'Fee deadline: 30 April 2025',
      content: 'Term 2 fees',
      publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    },
    {
      title: 'Homework due tomorrow',
      content: 'Mathematics assignment',
      publishedAt: new Date()
    }
  ];

  for (const notice of notices) {
    const existing = await prisma.notice.findFirst({
      where: { title: notice.title, targetAudience: 'PARENTS', archived: false }
    });
    if (existing) {
      await prisma.notice.update({
        where: { id: existing.id },
        data: {
          content: notice.content,
          status: 'PUBLISHED',
          publishedAt: notice.publishedAt,
          createdById
        }
      });
      continue;
    }

    await prisma.notice.create({
      data: {
        title: notice.title,
        content: notice.content,
        status: 'PUBLISHED',
        targetAudience: 'PARENTS',
        publishedAt: notice.publishedAt,
        createdById
      }
    });
  }
}

async function main() {
  console.log('🌱 Seeding parent dashboard demo data...');

  const parent = await ensureParent();
  const teacher = await ensureTeacher();

  const ethan = await ensureLearner(parent.id, {
    admissionNumber: 'ADM-ETHAN-001',
    firstName: 'Ethan',
    lastName: 'Kariuki',
    grade: 'GRADE_4',
    stream: '4A',
    gender: Gender.MALE
  });
  const amina = await ensureLearner(parent.id, {
    admissionNumber: 'ADM-AMINA-001',
    firstName: 'Amina',
    lastName: 'Kariuki',
    grade: 'GRADE_2',
    stream: '2B',
    gender: Gender.FEMALE
  });
  const brian = await ensureLearner(parent.id, {
    admissionNumber: 'ADM-BRIAN-001',
    firstName: 'Brian',
    lastName: 'Kariuki',
    grade: 'GRADE_6',
    stream: '6A',
    gender: Gender.MALE
  });

  await ensureAttendance(ethan.id, teacher.id, 18, 1);
  await ensureAttendance(amina.id, teacher.id, 18, 1);
  await ensureAttendance(brian.id, teacher.id, 17, 2);

  await ensureAssessmentData(
    ethan.id,
    teacher.id,
    'GRADE_4',
    [
      { name: 'Mathematics', marks: 85, grade: 'A' },
      { name: 'English', marks: 76, grade: 'B+' },
      { name: 'Science', marks: 82, grade: 'A-' }
    ],
    2
  );
  await ensureAssessmentData(
    amina.id,
    teacher.id,
    'GRADE_2',
    [
      { name: 'Mathematics', marks: 88, grade: 'A' },
      { name: 'English', marks: 79, grade: 'B+' },
      { name: 'Science', marks: 81, grade: 'A-' }
    ],
    1
  );
  await ensureAssessmentData(
    brian.id,
    teacher.id,
    'GRADE_6',
    [
      { name: 'Mathematics', marks: 83, grade: 'A' },
      { name: 'English', marks: 74, grade: 'B+' },
      { name: 'Science', marks: 80, grade: 'A-' }
    ],
    3
  );

  await ensureInvoices(ethan.id, teacher.id, 3500, 'INV-ETHAN-2025-T1', Grade.GRADE_4);
  await ensureInvoices(amina.id, teacher.id, 1200, 'INV-AMINA-2025-T1', Grade.GRADE_2);
  await ensureInvoices(brian.id, teacher.id, 4800, 'INV-BRIAN-2025-T1', Grade.GRADE_6);

  await ensureNotices(teacher.id);

  console.log('✅ Parent dashboard demo data seeded.');
  console.log(`   Parent login email: ${parent.email}`);
  console.log('   Suggested password: Parent123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
