import { TimetableEntry, TeacherAvailability, RoomAvailability } from '@prisma/client';

export type ConflictSeverity = 'ERROR' | 'WARNING';

export interface TimetableConflict {
  code: string;
  severity: ConflictSeverity;
  entryIds: string[];
  message: string;
  suggestedActions: string[];
  canOverride: boolean;
}

type EntryLike = Pick<TimetableEntry, 'id' | 'classId' | 'teacherId' | 'roomId' | 'day' | 'startTime' | 'endTime'>;

const minutes = (value: string) => {
  const [hours, mins] = String(value || '').split(':').map(Number);
  return (hours * 60) + mins;
};

const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);

const CLASH_META: Record<string, { message: string; suggestedActions: string[] }> = {
  CLASS_CLASH: { message: 'A class has overlapping lessons.', suggestedActions: ['Move one lesson', 'Swap one lesson with a free period'] },
  TEACHER_CLASH: { message: 'A teacher is assigned to overlapping lessons.', suggestedActions: ['Move one lesson', 'Assign another qualified teacher'] },
  ROOM_CLASH: { message: 'A room is assigned to overlapping lessons.', suggestedActions: ['Move one lesson', 'Select another suitable room'] },
};

export class ConflictEngineService {
  /**
   * Detects hard scheduling conflicts. Entries are bucketed by day (different
   * days can never conflict), then within each day grouped by class/teacher/
   * room so overlap checks only compare entries that share a resource —
   * O(sum of bucket_size^2) instead of O(n^2) over the whole version.
   */
  detect(
    entries: EntryLike[],
    teacherAvailability: TeacherAvailability[] = [],
    roomAvailability: RoomAvailability[] = []
  ): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];

    const byDay = new Map<string, EntryLike[]>();
    for (const entry of entries) {
      if (minutes(entry.startTime) >= minutes(entry.endTime)) {
        conflicts.push({
          code: 'INVALID_TIME_RANGE', severity: 'ERROR', entryIds: [entry.id],
          message: 'Lesson end time must be after its start time.',
          suggestedActions: ['Select a valid bell period', 'Correct the lesson start and end time'], canOverride: false
        });
      }
      if (!byDay.has(entry.day)) byDay.set(entry.day, []);
      byDay.get(entry.day)!.push(entry);
    }

    // Index blackout rules by resource+day so per-entry lookups are O(1)
    // instead of scanning the full rule list for every entry.
    const teacherRulesByKey = new Map<string, TeacherAvailability[]>();
    for (const rule of teacherAvailability) {
      if (rule.available) continue;
      const key = `${rule.teacherId}||${rule.day}`;
      if (!teacherRulesByKey.has(key)) teacherRulesByKey.set(key, []);
      teacherRulesByKey.get(key)!.push(rule);
    }
    const roomRulesByKey = new Map<string, RoomAvailability[]>();
    for (const rule of roomAvailability) {
      if (rule.available) continue;
      const key = `${rule.roomId}||${rule.day}`;
      if (!roomRulesByKey.has(key)) roomRulesByKey.set(key, []);
      roomRulesByKey.get(key)!.push(rule);
    }

    const pairwiseCheck = (bucket: EntryLike[], keyOf: (e: EntryLike) => string | null | undefined, code: keyof typeof CLASH_META) => {
      const groups = new Map<string, EntryLike[]>();
      for (const entry of bucket) {
        const key = keyOf(entry);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(entry);
      }
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        for (let i = 0; i < group.length; i += 1) {
          for (let j = i + 1; j < group.length; j += 1) {
            if (overlaps(group[i], group[j])) {
              conflicts.push({
                code, severity: 'ERROR', entryIds: [group[i].id, group[j].id],
                message: CLASH_META[code].message, suggestedActions: CLASH_META[code].suggestedActions, canOverride: false
              });
            }
          }
        }
      }
    };

    for (const [day, bucket] of byDay) {
      pairwiseCheck(bucket, e => e.classId, 'CLASS_CLASH');
      pairwiseCheck(bucket, e => e.teacherId, 'TEACHER_CLASH');
      pairwiseCheck(bucket, e => e.roomId, 'ROOM_CLASH');

      for (const entry of bucket) {
        if (entry.teacherId) {
          const rules = teacherRulesByKey.get(`${entry.teacherId}||${day}`);
          if (rules?.some(rule => overlaps(entry, rule))) {
            conflicts.push({
              code: 'TEACHER_UNAVAILABLE', severity: 'ERROR', entryIds: [entry.id],
              message: 'The assigned teacher is unavailable during this period.',
              suggestedActions: ['Move the lesson', 'Assign another qualified teacher'], canOverride: false
            });
          }
        }
        if (entry.roomId) {
          const rules = roomRulesByKey.get(`${entry.roomId}||${day}`);
          if (rules?.some(rule => overlaps(entry, rule))) {
            conflicts.push({
              code: 'ROOM_UNAVAILABLE', severity: 'ERROR', entryIds: [entry.id],
              message: 'The selected room is unavailable during this period.',
              suggestedActions: ['Move the lesson', 'Select another suitable room'], canOverride: false
            });
          }
        }
      }
    }

    return conflicts;
  }
}

export const conflictEngine = new ConflictEngineService();
