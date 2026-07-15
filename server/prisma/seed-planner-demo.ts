/**
 * Seeds companion Planner data for the local demonstration environment.
 *
 * Run after `npm run seed:timetable`. The script only upserts records owned by
 * the demo teachers and replaces assignments on its own named duty roster.
 */
import prisma from '../src/config/database';

const ACADEMIC_YEAR = 2026;
const TERM = 'TERM_2' as const;
const ROSTER_TITLE = 'Demo Campus Duty Roster — Term 2 2026';

const SCHEMES = [
  { email: 'mary.wanjiku@demo.school', grade: 'GRADE_7', area: 'English Language', title: 'Grade 7 English Language — Term 2', status: 'APPROVED' as const },
  { email: 'peter.otieno@demo.school', grade: 'GRADE_7', area: 'Mathematics', title: 'Grade 7 Mathematics — Term 2', status: 'SUBMITTED' as const },
  { email: 'grace.achieng@demo.school', grade: 'GRADE_8', area: 'Integrated Science', title: 'Grade 8 Integrated Science — Term 2', status: 'APPROVED' as const },
  { email: 'samuel.kiptoo@demo.school', grade: 'GRADE_8', area: 'Social Studies', title: 'Grade 8 Social Studies — Term 2', status: 'DRAFT' as const },
  { email: 'amina.hassan@demo.school', grade: 'GRADE_9', area: 'Kiswahili Lugha', title: 'Grade 9 Kiswahili Lugha — Term 2', status: 'SUBMITTED' as const },
  { email: 'faith.njeri@demo.school', grade: 'GRADE_9', area: 'Creative Arts and Sports', title: 'Grade 9 Creative Arts & Sports — Term 2', status: 'APPROVED' as const },
];

const weekData = (area: string) => Array.from({ length: 6 }, (_, index) => ({
  weekNumber: index + 1,
  strand: `${area} foundations`,
  subStrand: `Unit ${index + 1}: Explore and apply`,
  outcomes: `Learners demonstrate the key ${area.toLowerCase()} skills for this unit.`,
  inquiryQuestions: `How can we apply this week's ${area.toLowerCase()} learning in daily life?`,
  activities: 'Teacher modelling, paired practice, guided discussion and an individual reflection.',
  coreCompetencies: 'Communication and collaboration; Critical thinking and problem solving.',
  values: 'Responsibility, respect and integrity.',
  pertinentIssues: 'Digital citizenship and environmental awareness.',
  resources: 'Learner book, teacher guide, visual aids and approved digital resources.',
  assessment: 'Observation checklist, exit ticket and short practical task.',
  remarks: index === 0 ? 'Demo plan seeded for Planner testing.' : null,
}));

async function main() {
  const teachers = await prisma.user.findMany({
    where: { email: { in: SCHEMES.map((scheme) => scheme.email) } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const teacherByEmail = new Map(teachers.map((teacher) => [teacher.email, teacher]));

  if (teacherByEmail.size !== SCHEMES.length) {
    throw new Error('Demo teachers are missing. Run `npm run seed:timetable` first.');
  }

  const classes = await prisma.class.findMany({
    where: { grade: { in: ['GRADE_7', 'GRADE_8', 'GRADE_9'] }, academicYear: ACADEMIC_YEAR, term: TERM },
    select: { id: true, grade: true },
  });
  const classByGrade = new Map(classes.map((item) => [item.grade, item]));

  for (const scheme of SCHEMES) {
    const teacher = teacherByEmail.get(scheme.email)!;
    const existing = await prisma.schemeOfWork.upsert({
      where: {
        teacherId_grade_learningArea_term_academicYear: {
          teacherId: teacher.id,
          grade: scheme.grade,
          learningArea: scheme.area,
          term: TERM,
          academicYear: ACADEMIC_YEAR,
        },
      },
      update: { title: scheme.title, status: scheme.status, classId: classByGrade.get(scheme.grade)?.id, archived: false },
      create: {
        teacherId: teacher.id,
        grade: scheme.grade,
        learningArea: scheme.area,
        term: TERM,
        academicYear: ACADEMIC_YEAR,
        classId: classByGrade.get(scheme.grade)?.id,
        title: scheme.title,
        status: scheme.status,
      },
    });

    await prisma.schemeOfWorkWeek.deleteMany({ where: { schemeId: existing.id } });
    await prisma.schemeOfWorkWeek.createMany({ data: weekData(scheme.area).map((week) => ({ ...week, schemeId: existing.id })) });
  }

  const rosterOwner = teachers[0];
  const roster = await prisma.dutyRoster.upsert({
    where: { id: (await prisma.dutyRoster.findFirst({ where: { title: ROSTER_TITLE }, select: { id: true } }))?.id || '__new_demo_roster__' },
    update: { isActive: true, reminderEnabled: true, startDate: new Date('2026-07-13T00:00:00.000Z'), endDate: new Date('2026-07-24T23:59:59.000Z') },
    create: { title: ROSTER_TITLE, frequency: 'DAILY', startDate: new Date('2026-07-13T00:00:00.000Z'), endDate: new Date('2026-07-24T23:59:59.000Z'), createdById: rosterOwner.id },
  });

  await prisma.dutyRosterAssignment.deleteMany({ where: { rosterId: roster.id } });
  const duties = ['Morning gate', 'Break supervision', 'Lunch supervision', 'Afternoon gate'];
  const assignments = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 6, 13 + index + (Math.floor(index / 5) * 2)));
    const teacher = teachers[index % teachers.length];
    return { rosterId: roster.id, teacherId: teacher.id, dutyDate: date, role: duties[index % duties.length], notes: 'Demo duty assignment for Planner testing.' };
  });
  await prisma.dutyRosterAssignment.createMany({ data: assignments });

  console.log(JSON.stringify({ schemes: SCHEMES.length, schemeWeeks: SCHEMES.length * 6, roster: ROSTER_TITLE, dutyAssignments: assignments.length }, null, 2));
}

main().catch((error) => {
  console.error('[PLANNER DEMO SEED ERROR]', error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
