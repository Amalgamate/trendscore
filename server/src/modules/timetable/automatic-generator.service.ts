import { Prisma, TimetableLessonType, TimetableRoomType } from '@prisma/client';
import prisma from '../../config/database';
import { conflictEngine, TimetableConflict } from './conflict-engine.service';

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

type GenerateOptions = {
  classIds?: string[];
  days?: string[];
  maxDailyLessons?: number;
  randomSeed?: number;
};

type GeneratedEntry = Prisma.TimetableEntryUncheckedCreateWithoutVersionInput;

export type UnresolvedAllocation = {
  classId: string;
  className: string;
  learningAreaId: string;
  learningAreaName: string;
  requiredPeriods: number;
  scheduledPeriods: number;
  reason: string;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const overlaps = (left: { startTime: string; endTime: string }, right: { startTime: string; endTime: string }) =>
  left.startTime < right.endTime && right.startTime < left.endTime;

const seededRandom = (seed: number) => {
  let value = seed || 1;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};

export class AutomaticGeneratorService {
  async generate(versionId: string, options: GenerateOptions = {}) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { plan: { include: { bellSchedule: { include: { periods: true } } } }, entries: true }
    });
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(version.status)) throw new Error('This timetable version is not editable.');

    const days = options.days?.length ? options.days : DEFAULT_DAYS;
    const periods = version.plan.bellSchedule.periods
      .filter(period => period.active && period.instructional && period.type === 'LESSON')
      .sort((left, right) => left.sequence - right.sequence);
    if (!periods.length) throw new Error('The selected bell schedule has no instructional lesson periods.');

    const classes = await prisma.class.findMany({
      where: {
        active: true, archived: false, academicYear: version.plan.academicYear, term: version.plan.term,
        ...(options.classIds?.length ? { id: { in: options.classIds } } : {})
      },
      orderBy: [{ grade: 'asc' }, { stream: 'asc' }]
    });
    if (!classes.length) throw new Error('No active classes match this timetable plan.');

    const gradeKeys = [...new Set(classes.map(item => item.grade))];
    const [allocations, assignments, teacherRules, rooms, roomRules] = await Promise.all([
      prisma.instructionalAllocation.findMany({
        where: { academicYear: version.plan.academicYear, active: true },
        include: { learningArea: true }
      }),
      prisma.subjectAssignment.findMany({
        where: { active: true }, include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
      }),
      prisma.teacherAvailability.findMany({ where: { teacherId: { in: [] } } }),
      prisma.timetableRoom.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.roomAvailability.findMany()
    ]);
    // Fetch only relevant teacher rules after matching assignments across the school's grade naming conventions.
    const relevantAssignments = assignments.filter(item => gradeKeys.some(grade => normalize(grade) === normalize(item.grade)));
    const teacherIds = [...new Set(relevantAssignments.map(item => item.teacherId))];
    const availability = teacherIds.length
      ? await prisma.teacherAvailability.findMany({ where: { teacherId: { in: teacherIds } } })
      : teacherRules;

    const locked = version.entries.filter(entry => entry.locked);
    const generated: GeneratedEntry[] = [];
    const unresolved: UnresolvedAllocation[] = [];
    const teacherLoad = new Map<string, number>();
    const random = seededRandom(options.randomSeed || Date.now() % 100000);
    const occupied = () => [...locked, ...generated];

    const isFree = (candidate: { classId: string; teacherId?: string | null; roomId?: string | null; day: string; startTime: string; endTime: string }) => {
      if (occupied().some(entry => entry.day === candidate.day && overlaps(entry, candidate) && (
        entry.classId === candidate.classId ||
        (candidate.teacherId && entry.teacherId === candidate.teacherId) ||
        (candidate.roomId && entry.roomId === candidate.roomId)
      ))) return false;
      if (candidate.teacherId && availability.some(rule => rule.teacherId === candidate.teacherId && rule.day === candidate.day && !rule.available && overlaps(rule, candidate))) return false;
      if (candidate.roomId && roomRules.some(rule => rule.roomId === candidate.roomId && rule.day === candidate.day && !rule.available && overlaps(rule, candidate))) return false;
      return true;
    };

    const work = classes.flatMap(classItem => allocations
      .filter(allocation => normalize(allocation.grade) === normalize(classItem.grade))
      .map(allocation => ({ classItem, allocation })))
      .sort((left, right) => Number(Boolean(right.allocation.requiredRoomType)) - Number(Boolean(left.allocation.requiredRoomType)) || right.allocation.targetWeeklyPeriods - left.allocation.targetWeeklyPeriods);

    for (const { classItem, allocation } of work) {
      const candidates = relevantAssignments
        .filter(item => item.learningAreaId === allocation.learningAreaId && normalize(item.grade) === normalize(classItem.grade))
        .sort((left, right) => (teacherLoad.get(left.teacherId) || 0) - (teacherLoad.get(right.teacherId) || 0));
      const requiredRooms = allocation.requiredRoomType
        ? rooms.filter(room => room.type === allocation.requiredRoomType)
        : [null];
      let scheduled = locked.filter(entry => entry.classId === classItem.id && entry.learningAreaId === allocation.learningAreaId).length;
      let attempts = 0;

      while (scheduled < allocation.targetWeeklyPeriods && attempts < allocation.targetWeeklyPeriods * days.length * periods.length * 3) {
        attempts += 1;
        const remaining = allocation.targetWeeklyPeriods - scheduled;
        const blockSize = allocation.requiresDouble && remaining >= 2 ? 2 : 1;
        const slots = days.flatMap(day => periods.map((period, index) => ({ day, period, index })))
          .filter(slot => {
            if (blockSize === 2) {
              const next = periods[slot.index + 1];
              return Boolean(next && slot.period.endTime === next.startTime);
            }
            return true;
          })
          .map(slot => ({ ...slot, jitter: random() }))
          .sort((left, right) => {
            const leftDaily = occupied().filter(entry => entry.classId === classItem.id && entry.day === left.day).length;
            const rightDaily = occupied().filter(entry => entry.classId === classItem.id && entry.day === right.day).length;
            return leftDaily - rightDaily || left.period.sequence - right.period.sequence || left.jitter - right.jitter;
          });

        let placed = false;
        for (const slot of slots) {
          const dailyCount = occupied().filter(entry => entry.classId === classItem.id && entry.day === slot.day).length;
          if (dailyCount + blockSize > (options.maxDailyLessons || periods.length)) continue;
          const blockPeriods = blockSize === 2 ? [slot.period, periods[slot.index + 1]] : [slot.period];

          for (const assignment of candidates.length ? candidates : [null]) {
            for (const room of requiredRooms) {
              const block = blockPeriods.map(period => ({
                classId: classItem.id,
                learningAreaId: allocation.learningAreaId,
                teacherId: assignment?.teacherId || null,
                roomId: room?.id || null,
                bellPeriodId: period.id,
                day: slot.day,
                startTime: period.startTime,
                endTime: period.endTime,
                lessonType: blockSize === 2 ? TimetableLessonType.DOUBLE : TimetableLessonType.NORMAL,
                locked: false
              }));
              if (block.every(entry => isFree(entry)) && !block.some((entry, index) => block.slice(0, index).some(other => overlaps(entry, other)))) {
                generated.push(...block);
                if (assignment) teacherLoad.set(assignment.teacherId, (teacherLoad.get(assignment.teacherId) || 0) + block.length);
                scheduled += block.length;
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
          if (placed) break;
        }
        if (!placed) break;
      }

      if (scheduled < allocation.targetWeeklyPeriods) {
        unresolved.push({
          classId: classItem.id, className: classItem.name,
          learningAreaId: allocation.learningAreaId, learningAreaName: allocation.learningArea.name,
          requiredPeriods: allocation.targetWeeklyPeriods, scheduledPeriods: scheduled,
          reason: !candidates.length ? 'No active teacher assignment; unassigned slots were used where possible.'
            : allocation.requiredRoomType && !requiredRooms.length ? `No active ${allocation.requiredRoomType.replace(/_/g, ' ').toLowerCase()} is configured.`
              : 'No remaining clash-free period satisfies the configured constraints.'
        });
      }
    }

    await prisma.$transaction([
      prisma.timetableEntry.deleteMany({ where: { versionId, locked: false } }),
      prisma.timetableEntry.createMany({ data: generated.map(entry => ({ ...entry, versionId })) }),
      prisma.timetableVersion.update({ where: { id: versionId }, data: { status: version.status === 'DRAFT' ? 'GENERATED' : version.status } })
    ]);
    const entries = await prisma.timetableEntry.findMany({
      where: { versionId },
      include: {
        class: { select: { id: true, name: true, grade: true, stream: true } },
        learningArea: { select: { id: true, name: true, shortName: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { id: true, name: true, type: true } },
        bellPeriod: { select: { id: true, name: true, sequence: true } }
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }]
    });
    const conflicts: TimetableConflict[] = conflictEngine.detect(entries, availability, roomRules);

    return {
      versionId,
      entries,
      conflicts,
      unresolved,
      stats: {
        classes: classes.length,
        generatedEntries: generated.length,
        lockedEntries: locked.length,
        requiredPeriods: work.reduce((sum, item) => sum + item.allocation.targetWeeklyPeriods, 0),
        unresolvedAllocations: unresolved.length,
        hardConflicts: conflicts.filter(item => item.severity === 'ERROR').length
      }
    };
  }
}

export const automaticGeneratorService = new AutomaticGeneratorService();
