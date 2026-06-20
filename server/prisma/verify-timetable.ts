/**
 * verify-timetable.ts
 * Quick sanity check — prints a summary of seeded timetable data.
 * Usage: npm --prefix server run seed:timetable:verify
 */
import prisma from '../src/config/database';

async function main() {
  const classes = await prisma.class.findMany({
    where: { academicYear: 2026, term: 'TERM_2', institutionType: 'PRIMARY_CBC' },
    include: {
      teacher: { select: { firstName: true, lastName: true, subject: true } },
      _count: { select: { schedules: true } },
    },
    orderBy: { grade: 'asc' },
  });

  console.log('\n=== Classes ===');
  for (const cls of classes) {
    console.log(
      `  ${cls.name.padEnd(12)} | Room: ${(cls.room ?? '-').padEnd(10)} | ` +
      `Teacher: ${cls.teacher ? `${cls.teacher.firstName} ${cls.teacher.lastName}` : 'none'} | ` +
      `Schedules: ${cls._count.schedules}`
    );
  }

  // Sample one class — show Monday timetable
  if (classes.length > 0) {
    const sample = classes[0];
    const monday = await prisma.classSchedule.findMany({
      where: { classId: sample.id, day: 'Monday' },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        learningArea: { select: { name: true, color: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    console.log(`\n=== ${sample.name} — Monday Schedule ===`);
    for (const entry of monday) {
      console.log(
        `  ${entry.startTime}-${entry.endTime}  ` +
        `${(entry.subject).padEnd(28)} ` +
        `Room: ${(entry.room ?? '-').padEnd(16)} ` +
        `Teacher: ${entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : 'unassigned'}`
      );
    }
  }

  const totalSchedules = await prisma.classSchedule.count({
    where: { classId: { in: classes.map((c) => c.id) } },
  });

  const teachers = await prisma.user.count({ where: { role: 'TEACHER', institutionType: 'PRIMARY_CBC' } });
  const areas = await prisma.learningArea.count({ where: { gradeLevel: 'Junior School' } });

  console.log('\n=== Totals ===');
  console.log(`  Classes:        ${classes.length}`);
  console.log(`  Teachers:       ${teachers}`);
  console.log(`  Learning Areas: ${areas}`);
  console.log(`  Schedule Rows:  ${totalSchedules}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
