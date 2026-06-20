/**
 * seed-timetable.ts
 *
 * Populates the database with a realistic Junior School timetable for
 * end-to-end testing of the timetable feature.
 *
 * Creates:
 *   - 7 teachers (one per core subject)
 *   - 10 learning areas (Junior School CBC)
 *   - 3 classes: Grade 7A, Grade 8A, Grade 9A (2026 Term 2)
 *   - 120 schedule entries (8 slots × 5 days × 3 classes)
 *
 * Safe to re-run: classes and teachers are upserted;
 * schedules are wiped and recreated fresh each time.
 *
 * Usage:
 *   npm --prefix server run seed:timetable
 */

import bcrypt from 'bcrypt';
import prisma from '../src/config/database';

// ─── Time grid ──────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SLOTS: [string, string][] = [
  ['08:00', '08:45'],
  ['08:45', '09:30'],
  // break 09:30–09:50
  ['09:50', '10:35'],
  ['10:35', '11:20'],
  // break 11:20–11:40
  ['11:40', '12:25'],
  ['12:25', '13:10'],
  // lunch 13:10–14:00
  ['14:00', '14:45'],
  ['14:45', '15:30'],
];

// ─── Teacher definitions ─────────────────────────────────────────────────────

const TEACHERS: [string, string, string][] = [
  ['Mary',   'Wanjiku', 'English Language'],
  ['Peter',  'Otieno',  'Mathematics'],
  ['Grace',  'Achieng', 'Integrated Science'],
  ['Samuel', 'Kiptoo',  'Social Studies'],
  ['Amina',  'Hassan',  'Kiswahili Lugha'],
  ['Brian',  'Mwangi',  'Computer Studies'],
  ['Faith',  'Njeri',   'Creative Arts and Sports'],
];

// ─── Subject catalogue (Junior School CBC) ───────────────────────────────────

const SUBJECTS = [
  'English Language',
  'Kiswahili Lugha',
  'Mathematics',
  'Integrated Science',
  'Social Studies',
  'Pre-Technical Studies',
  'Agriculture',
  'Creative Arts and Sports',
  'Computer Studies',
  'Christian Religious Education',
];

// ─── Classes to seed ─────────────────────────────────────────────────────────

const GRADES: [string, string][] = [
  ['GRADE_7', 'Grade 7 A'],
  ['GRADE_8', 'Grade 8 A'],
  ['GRADE_9', 'Grade 9 A'],
];

const ACADEMIC_YEAR = 2026;
const TERM = 'TERM_2' as const;

// ─── Specialist rooms ─────────────────────────────────────────────────────────

const SPECIALIST_ROOMS = ['Science Lab', 'ICT Lab', 'Art Studio', 'Home Science Room'];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TrendSCORE Timetable Seed ===\n');

  // 1. Teachers
  console.log('Seeding teachers...');
  const password = await bcrypt.hash('Demo@123!', 10);
  const teachers = [];
  for (const [firstName, lastName, subject] of TEACHERS) {
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.school`;
    const teacher = await prisma.user.upsert({
      where: { email },
      update: {
        firstName,
        lastName,
        role: 'TEACHER',
        roles: ['TEACHER'],
        status: 'ACTIVE',
        institutionType: 'PRIMARY_CBC',
        verificationRequired: false,
        emailVerified: true,
        subject,
      },
      create: {
        email,
        password,
        firstName,
        lastName,
        role: 'TEACHER',
        roles: ['TEACHER'],
        status: 'ACTIVE',
        institutionType: 'PRIMARY_CBC',
        verificationRequired: false,
        emailVerified: true,
        subject,
      },
    });
    teachers.push(teacher);
    console.log(`  ✓ ${firstName} ${lastName} (${subject})`);
  }

  // 2. Learning Areas
  console.log('\nSeeding learning areas...');
  const COLORS = [
    '#0f766e', '#1d4ed8', '#dc2626', '#d97706', '#7c3aed',
    '#059669', '#db2777', '#ea580c', '#4f46e5', '#16a34a',
  ];
  const areas = [];
  for (let i = 0; i < SUBJECTS.length; i++) {
    const name = SUBJECTS[i];
    let area = await prisma.learningArea.findFirst({
      where: { name, gradeLevel: 'Junior School' },
    });
    if (!area) {
      area = await prisma.learningArea.create({
        data: {
          name,
          shortName: name.split(' ').map((w) => w[0]).join('').slice(0, 5),
          gradeLevel: 'Junior School',
          icon: '📚',
          color: COLORS[i % COLORS.length],
          institutionType: 'PRIMARY_CBC',
        },
      });
      console.log(`  ✓ Created: ${name}`);
    } else {
      console.log(`  – Existing: ${name}`);
    }
    areas.push(area);
  }

  // 3. Classes
  console.log('\nSeeding classes...');
  const classes = [];
  for (let i = 0; i < GRADES.length; i++) {
    const [grade, name] = GRADES[i];
    const classTeacher = teachers[i % teachers.length];
    const cls = await prisma.class.upsert({
      where: {
        grade_stream_academicYear_term: {
          grade,
          stream: 'A',
          academicYear: ACADEMIC_YEAR,
          term: TERM,
        },
      },
      update: {
        name,
        active: true,
        archived: false,
        institutionType: 'PRIMARY_CBC',
        teacherId: classTeacher.id,
        capacity: 40,
        room: `Room ${7 + i}A`,
      },
      create: {
        classCode: `SEED-${grade}-A-${ACADEMIC_YEAR}-T2`,
        name,
        grade,
        stream: 'A',
        academicYear: ACADEMIC_YEAR,
        term: TERM,
        active: true,
        archived: false,
        institutionType: 'PRIMARY_CBC',
        teacherId: classTeacher.id,
        capacity: 40,
        room: `Room ${7 + i}A`,
      },
    });
    classes.push(cls);
    console.log(`  ✓ ${name} (class teacher: ${classTeacher.firstName} ${classTeacher.lastName}, room: ${cls.room})`);
  }

  // 4. Schedules — wipe existing entries first so re-runs are idempotent
  console.log('\nClearing existing schedules for seeded classes...');
  const deleted = await prisma.classSchedule.deleteMany({
    where: { classId: { in: classes.map((c) => c.id) } },
  });
  console.log(`  Removed ${deleted.count} existing schedule entries.`);

  // Build a deterministic but varied timetable:
  //   - Subject rotates across slots + days so no two consecutive slots repeat
  //   - Teacher follows their primary subject where possible
  //   - Specialist rooms assigned for Science, ICT, Art slots
  console.log('\nCreating schedule entries...');

  const SPECIALIST_SUBJECTS: Record<string, string> = {
    'Integrated Science':        'Science Lab',
    'Computer Studies':          'ICT Lab',
    'Creative Arts and Sports':  'Art Studio',
    'Pre-Technical Studies':     'Home Science Room',
  };

  // Build a subject→teacher map (primary assignment)
  const subjectTeacherMap: Record<string, typeof teachers[0]> = {};
  for (const teacher of teachers) {
    if (teacher.subject) subjectTeacherMap[teacher.subject] = teacher;
  }

  let created = 0;
  for (let ci = 0; ci < classes.length; ci++) {
    const cls = classes[ci];

    for (let di = 0; di < DAYS.length; di++) {
      const day = DAYS[di];

      for (let si = 0; si < SLOTS.length; si++) {
        const [startTime, endTime] = SLOTS[si];

        // Deterministic subject rotation: offset per class so they don't all
        // teach the same subject at the same time (makes teacher conflicts visible)
        const areaIndex = (si * 2 + di + ci * 3) % areas.length;
        const area = areas[areaIndex];

        // Assign specialist teacher if we have one; otherwise round-robin
        const specialist = subjectTeacherMap[area.name];
        const teacher = specialist ?? teachers[(si + di + ci) % teachers.length];

        // Room: specialist room for lab/studio subjects, else class room
        const room = SPECIALIST_SUBJECTS[area.name] ?? cls.room ?? `Room ${7 + ci}A`;

        await prisma.classSchedule.create({
          data: {
            classId:       cls.id,
            subject:       area.name,
            day,
            startTime,
            endTime,
            room,
            teacherId:     teacher.id,
            learningAreaId: area.id,
            academicYear:  ACADEMIC_YEAR,
            active:        true,
          },
        });
        created++;
      }
    }
  }

  // 5. Summary
  console.log('\n=== Seed Complete ===');
  console.log(JSON.stringify({
    teachers:      teachers.length,
    learningAreas: areas.length,
    classes:       classes.map((c) => ({ name: c.name, id: c.id })),
    schedules:     created,
    academicYear:  ACADEMIC_YEAR,
    term:          TERM,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('\n[SEED ERROR]', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
