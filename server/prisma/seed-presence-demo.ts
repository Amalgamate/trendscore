/**
 * Seeds a small, repeatable Presence & Attendance scenario for the current
 * active school. It never deletes production data and only uses records whose
 * admission numbers / identifiers begin with DEMO-PRESENCE.
 *
 * Run after the normal demo users have been provisioned:
 *   npm run seed:presence-demo
 */
import { AttendanceStatus, Gender, LearnerStatus, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const atEAT = (hour: number, minute = 0) => {
  const date = todayUtc();
  // EAT is UTC+3; Date stores the equivalent UTC instant.
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - 3, minute));
};

async function ensureLearner(admissionNumber: string, firstName: string, gender: Gender) {
  return prisma.learner.upsert({
    where: { admissionNumber },
    update: { status: LearnerStatus.ACTIVE, archived: false },
    create: {
      admissionNumber,
      firstName,
      lastName: 'Demo',
      dateOfBirth: new Date('2012-01-15T00:00:00.000Z'),
      gender,
      grade: 'GRADE_8',
      stream: 'A',
      status: LearnerStatus.ACTIVE,
    },
    select: { id: true, firstName: true },
  });
}

async function projectEvent(input: {
  schoolId: string; personId: string; eventType: string; context: string;
  timestamp: Date; sourceModule: string; sourceRecordId: string;
  metadata?: Record<string, unknown>; location?: string; deviceId?: string; direction?: string;
}) {
  const existing = await prisma.presenceEvent.findFirst({
    where: {
      schoolId: input.schoolId,
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
      eventType: input.eventType,
    },
  });
  const data = {
    schoolId: input.schoolId,
    personId: input.personId,
    personType: 'LEARNER',
    eventType: input.eventType,
    context: input.context,
    timestamp: input.timestamp,
    sourceModule: input.sourceModule,
    sourceRecordId: input.sourceRecordId,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
    location: input.location ?? null,
    deviceId: input.deviceId ?? null,
    direction: input.direction ?? null,
    status: 'CONFIRMED',
  };
  return existing
    ? prisma.presenceEvent.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
    : prisma.presenceEvent.create({ data });
}

async function markClassAttendance(learnerId: string, markedBy: string, status: AttendanceStatus) {
  const date = todayUtc();
  const attendance = await prisma.attendance.upsert({
    where: { learnerId_date: { learnerId, date } },
    update: { status, markedBy, markedAt: atEAT(8, 0), source: 'DEMO' },
    create: { learnerId, date, status, markedBy, markedAt: atEAT(8, 0), source: 'DEMO' },
  });
  return attendance;
}

async function main() {
  const school = await prisma.school.findFirst({
    where: { active: true, archived: false },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  const operator = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'] }, archived: false, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!school || !operator) {
    throw new Error('An active school and administrator are required. Run the normal demo-user seed first.');
  }

  const [dayScholar, boarder, lateLearner, absentLearner] = await Promise.all([
    ensureLearner('DEMO-PRESENCE-DAY-001', 'Amani', Gender.FEMALE),
    ensureLearner('DEMO-PRESENCE-BOARD-001', 'Baraka', Gender.MALE),
    ensureLearner('DEMO-PRESENCE-LATE-001', 'Chiku', Gender.FEMALE),
    ensureLearner('DEMO-PRESENCE-ABSENT-001', 'Daudi', Gender.MALE),
  ]);

  const [dayAttendance, boardAttendance, lateAttendance, absentAttendance] = await Promise.all([
    markClassAttendance(dayScholar.id, operator.id, AttendanceStatus.PRESENT),
    markClassAttendance(boarder.id, operator.id, AttendanceStatus.PRESENT),
    markClassAttendance(lateLearner.id, operator.id, AttendanceStatus.LATE),
    markClassAttendance(absentLearner.id, operator.id, AttendanceStatus.ABSENT),
  ]);

  const terminal = await prisma.biometricDevice.upsert({
    where: { deviceId: 'DEMO-PRESENCE-GATE-01' },
    update: { name: 'Demo Main Gate', schoolId: school.id, location: 'Main Gate', status: 'ONLINE', syncMode: 'PUSH', lastSeen: new Date() },
    create: { deviceId: 'DEMO-PRESENCE-GATE-01', name: 'Demo Main Gate', schoolId: school.id, location: 'Main Gate', type: 'FACE', status: 'ONLINE', syncMode: 'PUSH', lastSeen: new Date() },
  });

  const dorm = await prisma.dormitory.upsert({
    where: { schoolId_name: { schoolId: school.id, name: 'Demo Acacia House' } },
    update: { active: true, archived: false, capacity: 40 },
    create: { schoolId: school.id, name: 'Demo Acacia House', gender: 'BOYS', capacity: 40, block: 'Demo Block' },
  });
  const assignment = await prisma.dormitoryAssignment.findFirst({
    where: { learnerId: boarder.id, academicYear: new Date().getUTCFullYear(), active: true },
  });
  if (!assignment) {
    await prisma.dormitoryAssignment.create({
      data: { dormitoryId: dorm.id, learnerId: boarder.id, academicYear: new Date().getUTCFullYear(), fromDate: todayUtc(), active: true },
    });
  }

  const nightRollCall = await prisma.dormRollCall.upsert({
    where: { dormitoryId_date_session: { dormitoryId: dorm.id, date: todayUtc(), session: 'NIGHT' } },
    update: { status: 'COMPLETED', completedAt: atEAT(21, 5) },
    create: { schoolId: school.id, dormitoryId: dorm.id, date: todayUtc(), session: 'NIGHT', conductedBy: operator.id, startedAt: atEAT(21), completedAt: atEAT(21, 5), status: 'COMPLETED' },
  });
  const rollEntry = await prisma.dormRollCallEntry.upsert({
    where: { rollCallId_learnerId: { rollCallId: nightRollCall.id, learnerId: boarder.id } },
    update: { status: 'PRESENT' },
    create: { rollCallId: nightRollCall.id, learnerId: boarder.id, status: 'PRESENT' },
  });
  const dining = await prisma.diningAttendance.upsert({
    where: { learnerId_date_session: { learnerId: boarder.id, date: todayUtc(), session: 'LUNCH' } },
    update: { present: true, recordedBy: operator.id },
    create: { schoolId: school.id, learnerId: boarder.id, date: todayUtc(), session: 'LUNCH', present: true, recordedBy: operator.id },
  });
  const prep = await prisma.prepAttendance.upsert({
    where: { learnerId_date_session: { learnerId: boarder.id, date: todayUtc(), session: 'EVENING' } },
    update: { present: true, recordedBy: operator.id },
    create: { schoolId: school.id, learnerId: boarder.id, date: todayUtc(), session: 'EVENING', present: true, recordedBy: operator.id },
  });

  await Promise.all([
    projectEvent({ schoolId: school.id, personId: dayScholar.id, eventType: 'BUS_BOARDED', context: 'BUS', timestamp: atEAT(7), sourceModule: 'DEMO_TRANSPORT', sourceRecordId: 'day-bus-in', metadata: { routeName: 'Demo Route', direction: 'OUTBOUND' } }),
    projectEvent({ schoolId: school.id, personId: dayScholar.id, eventType: 'GATE_ENTRY', context: 'GATE', timestamp: atEAT(7, 35), sourceModule: 'BIOMETRIC', sourceRecordId: 'day-gate-in', deviceId: terminal.id, direction: 'IN', location: 'Main Gate' }),
    projectEvent({ schoolId: school.id, personId: dayScholar.id, eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: atEAT(8), sourceModule: 'ATTENDANCE', sourceRecordId: dayAttendance.id, metadata: { attendanceStatus: 'PRESENT', grade: 'GRADE_8' } }),
    projectEvent({ schoolId: school.id, personId: dayScholar.id, eventType: 'GATE_EXIT', context: 'GATE', timestamp: atEAT(16), sourceModule: 'BIOMETRIC', sourceRecordId: 'day-gate-out', deviceId: terminal.id, direction: 'OUT', location: 'Main Gate' }),
    projectEvent({ schoolId: school.id, personId: boarder.id, eventType: 'GATE_ENTRY', context: 'GATE', timestamp: atEAT(6, 55), sourceModule: 'BIOMETRIC', sourceRecordId: 'board-gate-in', deviceId: terminal.id, direction: 'IN', location: 'Main Gate' }),
    projectEvent({ schoolId: school.id, personId: boarder.id, eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: atEAT(8), sourceModule: 'ATTENDANCE', sourceRecordId: boardAttendance.id, metadata: { attendanceStatus: 'PRESENT', grade: 'GRADE_8' } }),
    projectEvent({ schoolId: school.id, personId: boarder.id, eventType: 'DINING_ATTENDED', context: 'DINING_HALL', timestamp: atEAT(13), sourceModule: 'BOARDING', sourceRecordId: dining.id, metadata: { session: 'LUNCH' } }),
    projectEvent({ schoolId: school.id, personId: boarder.id, eventType: 'PREP_ATTENDED', context: 'PREP_HALL', timestamp: atEAT(19), sourceModule: 'BOARDING', sourceRecordId: prep.id, metadata: { session: 'EVENING' } }),
    projectEvent({ schoolId: school.id, personId: boarder.id, eventType: 'DORM_ROLL_CALL', context: 'DORMITORY', timestamp: atEAT(21), sourceModule: 'BOARDING', sourceRecordId: rollEntry.id, location: dorm.name, metadata: { session: 'NIGHT', rollCallStatus: 'PRESENT' } }),
    projectEvent({ schoolId: school.id, personId: lateLearner.id, eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: atEAT(8, 20), sourceModule: 'ATTENDANCE', sourceRecordId: lateAttendance.id, metadata: { attendanceStatus: 'LATE', grade: 'GRADE_8' } }),
    projectEvent({ schoolId: school.id, personId: absentLearner.id, eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: atEAT(8), sourceModule: 'ATTENDANCE', sourceRecordId: absentAttendance.id, metadata: { attendanceStatus: 'ABSENT', grade: 'GRADE_8' } }),
  ]);

  console.log(`Seeded Presence & Attendance demo for ${school.name}.`);
  console.log('Learners: DEMO-PRESENCE-DAY-001, DEMO-PRESENCE-BOARD-001, DEMO-PRESENCE-LATE-001, DEMO-PRESENCE-ABSENT-001');
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
