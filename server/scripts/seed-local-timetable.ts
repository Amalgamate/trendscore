import bcrypt from 'bcrypt';
import prisma from '../src/config/database';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const slots = [
  ['08:00', '08:45'],
  ['08:45', '09:30'],
  ['09:50', '10:35'],
  ['10:35', '11:20'],
  ['11:40', '12:25'],
  ['12:25', '13:10'],
  ['14:00', '14:45'],
  ['14:45', '15:30'],
];

const subjects = [
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

const teacherNames = [
  ['Mary', 'Wanjiku', 'English Language'],
  ['Peter', 'Otieno', 'Mathematics'],
  ['Grace', 'Achieng', 'Integrated Science'],
  ['Samuel', 'Kiptoo', 'Social Studies'],
  ['Amina', 'Hassan', 'Kiswahili Lugha'],
  ['Brian', 'Mwangi', 'Computer Studies'],
  ['Faith', 'Njeri', 'Creative Arts and Sports'],
];

const grades = [
  ['GRADE_7', 'Grade 7 A'],
  ['GRADE_8', 'Grade 8 A'],
  ['GRADE_9', 'Grade 9 A'],
];

async function main() {
  const existingSchool = await prisma.school.findFirst({
    where: { name: 'Demo School' },
  });

  const school = existingSchool
    ? await prisma.school.update({
      where: { id: existingSchool.id },
      data: {
      name: 'Demo School',
      active: true,
      status: 'ACTIVE',
      archived: false,
      institutionType: 'PRIMARY_CBC',
      institutionTypeLocked: true,
      requiresUserVerification: false,
    },
    })
    : await prisma.school.create({
      data: {
      id: 'demo-school',
      name: 'Demo School',
      active: true,
      status: 'ACTIVE',
      archived: false,
      institutionType: 'PRIMARY_CBC',
      institutionTypeLocked: true,
      requiresUserVerification: false,
    },
    });

  const password = await bcrypt.hash('Demo@123!', 10);
  const teachers = [];
  for (const [firstName, lastName, subject] of teacherNames) {
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
  }

  const areas = [];
  for (const name of subjects) {
    const existing = await prisma.learningArea.findFirst({
      where: { name, gradeLevel: 'Junior School' },
    });
    if (existing) {
      areas.push(existing);
      continue;
    }
    areas.push(await prisma.learningArea.create({
      data: {
        name,
        shortName: name.split(' ').map((word) => word[0]).join('').slice(0, 5),
        gradeLevel: 'Junior School',
        icon: 'book',
        color: '#0f766e',
      },
    }));
  }

  const classes = [];
  for (let index = 0; index < grades.length; index += 1) {
    const [grade, name] = grades[index];
    const classData = await prisma.class.upsert({
      where: {
        grade_stream_academicYear_term: {
          grade,
          stream: 'A',
          academicYear: 2026,
          term: 'TERM_2',
        },
      },
      update: {
        name,
        active: true,
        archived: false,
        institutionType: 'PRIMARY_CBC',
        teacherId: teachers[index % teachers.length].id,
        capacity: 40,
        room: `Room ${7 + index}A`,
      },
      create: {
        classCode: `DEMO-${grade}-A-2026-T2`,
        name,
        grade,
        stream: 'A',
        academicYear: 2026,
        term: 'TERM_2',
        active: true,
        archived: false,
        institutionType: 'PRIMARY_CBC',
        teacherId: teachers[index % teachers.length].id,
        capacity: 40,
        room: `Room ${7 + index}A`,
      },
    });
    classes.push(classData);
  }

  await prisma.classSchedule.deleteMany({
    where: { classId: { in: classes.map((classData) => classData.id) } },
  });

  let created = 0;
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const classData = classes[classIndex];
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const area = areas[(slotIndex + dayIndex + classIndex * 2) % areas.length];
        const teacher = teachers[(slotIndex + dayIndex + classIndex) % teachers.length];
        await prisma.classSchedule.create({
          data: {
            classId: classData.id,
            subject: area.name,
            day: days[dayIndex],
            startTime: slots[slotIndex][0],
            endTime: slots[slotIndex][1],
            room: slotIndex < 6 ? classData.room : ['Lab 1', 'Art Studio', 'Field'][classIndex],
            teacherId: teacher.id,
            learningAreaId: area.id,
            academicYear: 2026,
            active: true,
          },
        });
        created += 1;
      }
    }
  }

  console.log(JSON.stringify({
    school: school.name,
    classes: classes.map((classData) => classData.name),
    teachers: teachers.length,
    learningAreas: areas.length,
    schedules: created,
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
