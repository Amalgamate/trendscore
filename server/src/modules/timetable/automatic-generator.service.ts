import { Prisma, TimetableLessonType } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import { conflictEngine, TimetableConflict } from './conflict-engine.service';

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

type GenerateOptions = {
  classIds?: string[];
  days?: string[];
  maxDailyLessons?: number;
  maxTeacherDailyLessons?: number;
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

type SlotEntry = {
  classId: string;
  teacherId?: string | null;
  roomId?: string | null;
  day: string;
  startTime: string;
  endTime: string;
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

/** Deterministic default seed derived from the version id, so repeated runs on
 *  the same version produce the same timetable unless a seed is passed. */
const hashSeed = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  return hash % 233280 || 1;
};

/**
 * In-memory occupancy index. Conflict checks and daily-load lookups touch only
 * the small per-day buckets instead of rescanning every entry on every probe.
 */
class OccupancyIndex {
  private classDay = new Map<string, SlotEntry[]>();
  private teacherDay = new Map<string, SlotEntry[]>();
  private roomDay = new Map<string, SlotEntry[]>();
  classDayCounts = new Map<string, number>();
  teacherDayCounts = new Map<string, number>();
  /** `${classId}||${learningAreaId}||${day}` -> lesson count, for spread checks. */
  classAreaDay = new Map<string, number>();

  private key(...parts: (string | null | undefined)[]) { return parts.join('||'); }

  add(entry: SlotEntry & { learningAreaId: string }) {
    const classKey = this.key(entry.classId, entry.day);
    const teacherKey = entry.teacherId ? this.key(entry.teacherId, entry.day) : null;
    const roomKey = entry.roomId ? this.key(entry.roomId, entry.day) : null;
    if (!this.classDay.has(classKey)) this.classDay.set(classKey, []);
    this.classDay.get(classKey)!.push(entry);
    this.classDayCounts.set(classKey, (this.classDayCounts.get(classKey) || 0) + 1);
    if (teacherKey) {
      if (!this.teacherDay.has(teacherKey)) this.teacherDay.set(teacherKey, []);
      this.teacherDay.get(teacherKey)!.push(entry);
      this.teacherDayCounts.set(teacherKey, (this.teacherDayCounts.get(teacherKey) || 0) + 1);
    }
    if (roomKey) {
      if (!this.roomDay.has(roomKey)) this.roomDay.set(roomKey, []);
      this.roomDay.get(roomKey)!.push(entry);
    }
    const areaKey = this.key(entry.classId, entry.learningAreaId, entry.day);
    this.classAreaDay.set(areaKey, (this.classAreaDay.get(areaKey) || 0) + 1);
  }

  conflictsWith(entry: SlotEntry) {
    for (const other of this.classDay.get(this.key(entry.classId, entry.day)) || []) {
      if (overlaps(other, entry)) return true;
    }
    if (entry.teacherId) {
      for (const other of this.teacherDay.get(this.key(entry.teacherId, entry.day)) || []) {
        if (overlaps(other, entry)) return true;
      }
    }
    if (entry.roomId) {
      for (const other of this.roomDay.get(this.key(entry.roomId, entry.day)) || []) {
        if (overlaps(other, entry)) return true;
      }
    }
    return false;
  }

  classDayCount(classId: string, day: string) { return this.classDayCounts.get(this.key(classId, day)) || 0; }
  teacherDayCount(teacherId: string, day: string) { return this.teacherDayCounts.get(this.key(teacherId, day)) || 0; }
  classAreaDayCount(classId: string, learningAreaId: string, day: string) { return this.classAreaDay.get(this.key(classId, learningAreaId, day)) || 0; }

  teacherEntries(teacherId: string, day: string) { return this.teacherDay.get(this.key(teacherId, day)) || []; }
  teacherIds() { return [...new Set([...this.teacherDay.keys()].map(key => key.split('||')[0]))]; }
  /** All entries on a given day, across classes — used for soft-warning scans. */
  entriesByDay(day: string) {
    return [...this.classDay.entries()]
      .filter(([key]) => key.endsWith(`||${day}`))
      .flatMap(([, entries]) => entries) as (SlotEntry & { learningAreaId: string })[];
  }
  classIds() { return [...new Set([...this.classDay.keys()].map(key => key.split('||')[0]))]; }
}

export class AutomaticGeneratorService {
  async generate(versionId: string, options: GenerateOptions = {}) {
    const version = await prisma.timetableVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { plan: { include: { bellSchedule: { include: { periods: true } } } }, entries: true }
    });
    if (['PUBLISHED', 'LOCKED', 'ARCHIVED'].includes(version.status)) {
      throw new ApiError(400, 'This timetable version is not editable.');
    }

    const days = options.days?.length ? options.days : DEFAULT_DAYS;
    const periods = version.plan.bellSchedule.periods
      .filter(period => period.active && period.instructional && period.type === 'LESSON')
      .sort((left, right) => left.sequence - right.sequence);
    if (!periods.length) {
      throw new ApiError(400, 'The selected bell schedule has no instructional lesson periods.');
    }

    const classes = await prisma.class.findMany({
      where: {
        active: true, archived: false, academicYear: version.plan.academicYear, term: version.plan.term,
        ...(options.classIds?.length ? { id: { in: options.classIds } } : {})
      },
      orderBy: [{ grade: 'asc' }, { stream: 'asc' }]
    });
    if (!classes.length) {
      throw new ApiError(400, `No active classes match this timetable plan (${version.plan.academicYear} ${version.plan.term.replace('_', ' ')}). Please ensure your classes are configured for this academic year and term.`);
    }

    const gradeKeys = [...new Set(classes.map(item => item.grade))];
    const [allocations, assignments, rooms, roomRules] = await Promise.all([
      prisma.instructionalAllocation.findMany({
        where: { academicYear: version.plan.academicYear, active: true },
        include: { learningArea: true }
      }),
      prisma.subjectAssignment.findMany({
        // Scope to grades that actually appear in this plan's class list.
        // normalize() strips non-alphanumeric chars so GRADE_7 == Grade7 == grade 7.
        where: {
          active: true,
          grade: { in: gradeKeys.flatMap(g => [g, g.replace(/_/g, ' ')]) }
        },
        include: { teacher: { select: { id: true, firstName: true, lastName: true } } }
      }),
      prisma.timetableRoom.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.roomAvailability.findMany()
    ]);
    // Secondary normalize pass: the DB grade values may still differ in casing/spacing
    // from the class grade values even after the `in` filter above (e.g. "GRADE 7" vs
    // "GRADE_7"). Keep the normalize() filter as the authoritative match.
    const relevantAssignments = assignments.filter(item =>
      gradeKeys.some(grade => normalize(grade) === normalize(item.grade))
    );
    const teacherIds = [...new Set(relevantAssignments.map(item => item.teacherId))];
    const availability = teacherIds.length
      ? await prisma.teacherAvailability.findMany({ where: { teacherId: { in: teacherIds } } })
      : [];

    const occupancy = new OccupancyIndex();
    // Blackout windows (available === false) per teacher/room/day.
    const teacherBlocks = new Map<string, { startTime: string; endTime: string }[]>();
    const roomBlocks = new Map<string, { startTime: string; endTime: string }[]>();
    for (const rule of availability) {
      if (rule.available) continue;
      const key = `${rule.teacherId}||${rule.day}`;
      if (!teacherBlocks.has(key)) teacherBlocks.set(key, []);
      teacherBlocks.get(key)!.push({ startTime: rule.startTime, endTime: rule.endTime });
    }
    for (const rule of roomRules) {
      if (rule.available) continue;
      const key = `${rule.roomId}||${rule.day}`;
      if (!roomBlocks.has(key)) roomBlocks.set(key, []);
      roomBlocks.get(key)!.push({ startTime: rule.startTime, endTime: rule.endTime });
    }

    const locked = version.entries.filter(entry => entry.locked);
    for (const entry of locked) occupancy.add(entry);
    const generated: GeneratedEntry[] = [];
    const unresolved: UnresolvedAllocation[] = [];
    const teacherLoad = new Map<string, number>();
    const random = seededRandom(options.randomSeed ?? hashSeed(versionId));

    const maxDailyLessons = options.maxDailyLessons || periods.length;
    // Soft cap: preferred maximum lessons for one teacher in one day. Defaults to
    // the full day (no effective constraint); placement prefers candidates under
    // the cap and only falls back to others when nothing else fits.
    const softTeacherDailyCap = options.maxTeacherDailyLessons || periods.length;

    const isFree = (candidate: SlotEntry) => {
      if (occupancy.conflictsWith(candidate)) return false;
      for (const block of teacherBlocks.get(`${candidate.teacherId}||${candidate.day}`) || []) {
        if (overlaps(candidate, block)) return false;
      }
      for (const block of roomBlocks.get(`${candidate.roomId}||${candidate.day}`) || []) {
        if (overlaps(candidate, block)) return false;
      }
      return true;
    };

    // Hardest allocations first: room-constrained subjects, then doubles, then the
    // largest weekly targets — so constrained work isn't crowded out by easy work.
    const work = classes.flatMap(classItem => allocations
      .filter(allocation => normalize(allocation.grade) === normalize(classItem.grade))
      .map(allocation => ({ classItem, allocation })))
      .sort((left, right) =>
        Number(Boolean(right.allocation.requiredRoomType)) - Number(Boolean(left.allocation.requiredRoomType)) ||
        Number(right.allocation.requiresDouble) - Number(left.allocation.requiresDouble) ||
        right.allocation.targetWeeklyPeriods - left.allocation.targetWeeklyPeriods);

    const placeAllocation = (classItem: (typeof classes)[number], allocation: (typeof allocations)[number]) => {
      const candidates = relevantAssignments
        .filter(item => item.learningAreaId === allocation.learningAreaId && normalize(item.grade) === normalize(classItem.grade))
        .sort((left, right) => (teacherLoad.get(left.teacherId) || 0) - (teacherLoad.get(right.teacherId) || 0));
      const requiredRooms = allocation.requiredRoomType
        ? rooms.filter(room => room.type === allocation.requiredRoomType)
        : [null];
      let scheduled = locked.filter(entry => entry.classId === classItem.id && entry.learningAreaId === allocation.learningAreaId).length;
      let preferDouble = Boolean(allocation.requiresDouble);
      let attempts = 0;

      while (scheduled < allocation.targetWeeklyPeriods && attempts < allocation.targetWeeklyPeriods * days.length * periods.length * 3) {
        attempts += 1;
        const remaining = allocation.targetWeeklyPeriods - scheduled;
        const blockSize = preferDouble && remaining >= 2 ? 2 : 1;
        const slots = days.flatMap(day => periods.map((period, index) => ({ day, period, index })))
          .filter(slot => {
            if (blockSize === 2) {
              const next = periods[slot.index + 1];
              return Boolean(next && slot.period.endTime === next.startTime);
            }
            return true;
          })
          .map(slot => ({ ...slot, jitter: random() }))
          .sort((left, right) =>
            occupancy.classDayCount(classItem.id, left.day) - occupancy.classDayCount(classItem.id, right.day) ||
            occupancy.classAreaDayCount(classItem.id, allocation.learningAreaId, left.day) - occupancy.classAreaDayCount(classItem.id, allocation.learningAreaId, right.day) ||
            left.period.sequence - right.period.sequence ||
            left.jitter - right.jitter);

        let placed = false;
        for (const slot of slots) {
          const dailyCount = occupancy.classDayCount(classItem.id, slot.day);
          if (dailyCount + blockSize > maxDailyLessons) continue;
          const blockPeriods = blockSize === 2 ? [slot.period, periods[slot.index + 1]] : [slot.period];

          // Two candidate passes: first only teachers still under the soft daily
          // cap; if none fits, fall back to any candidate so placement never
          // blocks on a soft preference.
          const orderedCandidates = candidates.length ? candidates : [null];
          const underCap = orderedCandidates.filter(candidate =>
            !candidate || occupancy.teacherDayCount(candidate.teacherId, slot.day) < softTeacherDailyCap);
          // Run the capped pass first; fall back to the unrestricted pass only
          // when the capped pass had candidates but nothing fit.
          const candidateSets = underCap.length ? [underCap, orderedCandidates] : [orderedCandidates];
          for (const candidateSet of candidateSets) {
            for (const assignment of candidateSet) {
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
                  for (const entry of block) occupancy.add(entry as SlotEntry & { learningAreaId: string });
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
          if (placed) break;
        }
        if (!placed) {
          // A requiresDouble allocation should degrade to singles instead of
          // being abandoned when no contiguous pair is free.
          if (preferDouble && blockSize === 2) { preferDouble = false; continue; }
          break;
        }
      }

      const reason = !candidates.length ? 'No active teacher assignment; unassigned slots were used where possible.'
        : allocation.requiredRoomType && !requiredRooms.length ? `No active ${allocation.requiredRoomType.replace(/_/g, ' ').toLowerCase()} is configured.`
          : 'No remaining clash-free period satisfies the configured constraints.';
      return { scheduled, reason, candidatesExist: candidates.length > 0, roomsConfigured: allocation.requiredRoomType ? requiredRooms.length > 0 : true };
    };

    for (const { classItem, allocation } of work) {
      const result = placeAllocation(classItem, allocation);
      if (result.scheduled < allocation.targetWeeklyPeriods) {
        unresolved.push({
          classId: classItem.id, className: classItem.name,
          learningAreaId: allocation.learningAreaId, learningAreaName: allocation.learningArea.name,
          requiredPeriods: allocation.targetWeeklyPeriods, scheduledPeriods: result.scheduled,
          reason: result.reason
        });
      }
    }

    // Soft-quality scan (report only — never blocks generation).
    const softWarnings: string[] = [];
    for (const teacherId of occupancy.teacherIds()) {
      for (const day of days) {
        const count = occupancy.teacherDayCount(teacherId, day);
        if (count > softTeacherDailyCap) {
          softWarnings.push(`Teacher ${teacherId} has ${count} lessons on ${day}, above the soft cap of ${softTeacherDailyCap}.`);
          if (softWarnings.length >= 20) break;
        }
      }
      if (softWarnings.length >= 20) break;
    }
    for (const classId of occupancy.classIds()) {
      const classItem = classes.find(item => item.id === classId);
      for (const day of days) {
        const dayEntries = occupancy.entriesByDay(day).filter(entry => entry.classId === classId);
        const counts = new Map<string, number>();
        for (const entry of dayEntries) counts.set(entry.learningAreaId, (counts.get(entry.learningAreaId) || 0) + 1);
        for (const [learningAreaId, count] of counts) {
          if (count > 1) {
            const area = allocations.find(item => item.learningAreaId === learningAreaId)?.learningArea.name || learningAreaId;
            softWarnings.push(`${classItem?.name || classId} has ${count} lessons of the same learning area (${area}) on ${day}.`);
            if (softWarnings.length >= 20) break;
          }
        }
        if (softWarnings.length >= 20) break;
      }
      if (softWarnings.length >= 20) break;
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
        hardConflicts: conflicts.filter(item => item.severity === 'ERROR').length,
        softWarnings
      }
    };
  }
}

export const automaticGeneratorService = new AutomaticGeneratorService();
