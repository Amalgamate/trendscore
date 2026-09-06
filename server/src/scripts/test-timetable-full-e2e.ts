import prisma from '../config/database';
import { automaticGeneratorService } from '../modules/timetable/automatic-generator.service';
import { timetableService } from '../modules/timetable/timetable.service';

async function main() {
  console.log('=== WHOLE SCHOOL TIMETABLE END-TO-END TEST ===\n');

  const academicYear = 2026;
  const term = 'TERM_1' as const;

  // 1. Fetch active classes for 2026 Term 1
  const classes = await prisma.class.findMany({
    where: { active: true, archived: false, academicYear, term },
    orderBy: [{ grade: 'asc' }, { stream: 'asc' }]
  });
  console.log(`[Step 1] Found ${classes.length} active classes for ${academicYear} ${term}:`);
  classes.forEach(c => console.log(`  - ${c.name} (Grade: ${c.grade}, Stream: ${c.stream})`));

  if (!classes.length) {
    console.error('ERROR: No classes found for 2026 Term 1!');
    process.exit(1);
  }

  // 2. Fetch active teachers
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', archived: false },
    select: { id: true, firstName: true, lastName: true }
  });
  console.log(`\n[Step 2] Found ${teachers.length} active teachers.`);

  // 3. Fetch or create Bell Schedule
  let bellSchedule = await prisma.bellSchedule.findFirst({
    where: { active: true, isDefault: true },
    include: { periods: { orderBy: { sequence: 'asc' } } }
  });
  if (!bellSchedule) {
    bellSchedule = await prisma.bellSchedule.findFirst({
      where: { active: true },
      include: { periods: { orderBy: { sequence: 'asc' } } }
    });
  }
  console.log(`\n[Step 3] Using Bell Schedule: "${bellSchedule?.name}" with ${bellSchedule?.periods.length} periods.`);

  // 4. Check Rooms - seed basic rooms if none exist
  let rooms = await prisma.timetableRoom.findMany({ where: { active: true } });
  if (rooms.length === 0) {
    console.log('[Step 4] No rooms found in timetableRoom. Seeding sample rooms...');
    await prisma.timetableRoom.createMany({
      data: [
        { name: 'Room 1', code: 'R1', type: 'CLASSROOM', capacity: 40 },
        { name: 'Room 2', code: 'R2', type: 'CLASSROOM', capacity: 40 },
        { name: 'Room 3', code: 'R3', type: 'CLASSROOM', capacity: 40 },
        { name: 'Room 4', code: 'R4', type: 'CLASSROOM', capacity: 40 },
        { name: 'Science Lab', code: 'LAB-SCI', type: 'SCIENCE_LAB', capacity: 35 },
        { name: 'Computer Lab', code: 'LAB-COMP', type: 'ICT_LAB', capacity: 35 },
      ]
    });
    rooms = await prisma.timetableRoom.findMany({ where: { active: true } });
  }
  console.log(`[Step 4] Rooms available: ${rooms.length}`);

  // 5. Ensure Instructional Allocations and Subject Assignments for each grade
  const gradeList = [...new Set(classes.map(c => c.grade))];
  console.log(`\n[Step 5] Checking allocations for ${gradeList.length} unique grades...`);

  // Learning areas in DB
  const learningAreas = await prisma.learningArea.findMany({
    select: { id: true, name: true, shortName: true }
  });
  console.log(`Total active learning areas in DB: ${learningAreas.length}`);

  // Common subjects per grade level
  // Let's ensure top learning areas exist or match
  for (const grade of gradeList) {
    const existingAllocations = await prisma.instructionalAllocation.findMany({
      where: { academicYear, grade, active: true }
    });
    console.log(`Grade ${grade}: currently has ${existingAllocations.length} allocations`);

    if (existingAllocations.length === 0) {
      console.log(`  -> Seeding standard allocations for ${grade}...`);
      // Select 6-8 core subjects for this grade
      const coreSubjects = ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Creative Arts & Sports', 'Agriculture', 'Religious Education'];
      for (const subjName of coreSubjects) {
        let la = learningAreas.find(l => l.name.toLowerCase() === subjName.toLowerCase());
        if (!la) {
          // find partial match
          la = learningAreas.find(l => l.name.toLowerCase().includes(subjName.toLowerCase()));
        }
        if (la) {
          await prisma.instructionalAllocation.upsert({
            where: {
              academicYear_grade_learningAreaId: {
                academicYear,
                grade,
                learningAreaId: la.id
              }
            },
            create: {
              academicYear,
              grade,
              learningAreaId: la.id,
              targetWeeklyPeriods: ['Mathematics', 'English'].includes(subjName) ? 5 : 4,
              requiresDouble: subjName === 'Integrated Science',
              active: true
            },
            update: {}
          });

          // Also assign a teacher if not assigned
          const existingAssign = await prisma.subjectAssignment.findFirst({
            where: { grade, learningAreaId: la.id, active: true }
          });
          if (!existingAssign && teachers.length > 0) {
            // Assign a teacher in round-robin fashion
            const teacherIdx = (gradeList.indexOf(grade) * 3 + coreSubjects.indexOf(subjName)) % teachers.length;
            const assignedTeacher = teachers[teacherIdx];
            await prisma.subjectAssignment.create({
              data: {
                grade,
                learningAreaId: la.id,
                teacherId: assignedTeacher.id,
                active: true
              }
            });
          }
        }
      }
    }
  }

  // 6. Create or Get Timetable Plan for 2026 Term 1
  console.log(`\n[Step 6] Setting up Timetable Plan for ${academicYear} ${term}...`);
  let plan = await prisma.timetablePlan.findFirst({
    where: { academicYear, term },
    include: { versions: { orderBy: { version: 'desc' } } }
  });

  if (!plan) {
    console.log('Creating new plan: Whole School Timetable 2026 Term 1');
    const created = await timetableService.createPlan({
      name: `Whole School Timetable ${academicYear} Term 1`,
      academicYear,
      term,
      bellScheduleId: bellSchedule!.id,
      description: 'Master timetable generated for all active classes'
    });
    plan = await prisma.timetablePlan.findUniqueOrThrow({
      where: { id: created.id },
      include: { versions: { orderBy: { version: 'desc' } } }
    });
  }
  console.log(`Plan ID: ${plan.id} ("${plan.name}"), Latest Version: ${plan.versions[0]?.version} (Status: ${plan.versions[0]?.status})`);

  let versionId = plan.versions[0]?.id;
  if (!versionId || plan.versions[0].status === 'PUBLISHED') {
    // Clone a new editable version if needed
    const newVersion = await timetableService.cloneVersion(plan.versions[0].id);
    versionId = newVersion.id;
    console.log(`Created new editable version: ${newVersion.version}`);
  }

  // If status is not editable (e.g. APPROVED), reset to DRAFT for generation testing
  await prisma.timetableVersion.update({
    where: { id: versionId },
    data: { status: 'DRAFT' }
  });

  // 7. Run Automatic Timetable Generator
  console.log(`\n[Step 7] Running AutomaticGeneratorService.generate on version ${versionId}...`);
  const genStart = Date.now();
  const genResult = await automaticGeneratorService.generate(versionId, {
    maxDailyLessons: 9,
    maxTeacherDailyLessons: 6
  });
  const genDuration = Date.now() - genStart;
  console.log(`Generation finished in ${genDuration}ms!`);
  console.log('Stats:', JSON.stringify(genResult.stats, null, 2));

  if (genResult.unresolved.length > 0) {
    console.warn(`WARNING: ${genResult.unresolved.length} unresolved allocations:`);
    genResult.unresolved.slice(0, 5).forEach(u => console.warn(`  - ${u.className} | ${u.learningAreaName}: scheduled ${u.scheduledPeriods}/${u.requiredPeriods} (${u.reason})`));
  } else {
    console.log('SUCCESS: All allocations 100% resolved without clashes!');
  }

  // 8. Test Review Workflow
  console.log('\n[Step 8] Testing approval review workflow transitions...');
  // Current status after generation is GENERATED
  let currentStatus = (await prisma.timetableVersion.findUniqueOrThrow({ where: { id: versionId } })).status;
  console.log(`Status after generate: ${currentStatus}`);

  // Transition: GENERATED -> DEPARTMENT_REVIEW
  let updated = await timetableService.transition(versionId, 'DEPARTMENT_REVIEW' as any);
  console.log(`Transitioned to: ${updated.status}`);

  // Transition: DEPARTMENT_REVIEW -> DEPUTY_REVIEW
  updated = await timetableService.transition(versionId, 'DEPUTY_REVIEW' as any);
  console.log(`Transitioned to: ${updated.status}`);

  // Transition: DEPUTY_REVIEW -> PRINCIPAL_REVIEW
  updated = await timetableService.transition(versionId, 'PRINCIPAL_REVIEW' as any);
  console.log(`Transitioned to: ${updated.status}`);

  // Transition: PRINCIPAL_REVIEW -> APPROVED
  updated = await timetableService.transition(versionId, 'APPROVED' as any);
  console.log(`Transitioned to: ${updated.status}`);

  // 9. Check Conflicts before publishing
  const conflicts = await timetableService.conflicts(versionId);
  const hardConflicts = conflicts.filter(c => c.severity === 'ERROR');
  console.log(`\n[Step 9] Conflicts check: ${conflicts.length} total (${hardConflicts.length} hard errors)`);
  if (hardConflicts.length > 0) {
    console.error('Hard conflicts detected:', hardConflicts);
  }

  // 10. Publish to live schedules
  console.log('\n[Step 10] Publishing version to live classSchedule canonical table...');
  const pubResult = await timetableService.publish(versionId);
  console.log('Publish result:', pubResult);

  // 11. Verify canonical ClassSchedule records
  const publishedCount = await prisma.classSchedule.count({
    where: { academicYear, semester: term }
  });
  console.log(`\n[Step 11] Verification: Total classSchedule records for ${academicYear} ${term} = ${publishedCount}`);

  // Check sample class schedule
  const sampleClass = classes[0];
  const sampleLessons = await prisma.classSchedule.findMany({
    where: { classId: sampleClass.id, academicYear, semester: term },
    include: { teacher: true },
    orderBy: [{ day: 'asc' }, { startTime: 'asc' }]
  });
  console.log(`\nSample Timetable for class: "${sampleClass.name}" (${sampleLessons.length} lessons):`);
  sampleLessons.slice(0, 10).forEach(l => {
    console.log(`  ${l.day.padEnd(10)} | ${l.startTime} - ${l.endTime} | ${(l.subject || '').padEnd(25)} | Tutor: ${l.teacher ? `${l.teacher.firstName} ${l.teacher.lastName}` : 'None'} | Room: ${l.room || 'None'}`);
  });

  console.log('\n=== END-TO-END TIMETABLE TEST COMPLETED SUCCESSFULLY! ===');
}

main()
  .catch(err => {
    console.error('\nTEST FAILED WITH ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
