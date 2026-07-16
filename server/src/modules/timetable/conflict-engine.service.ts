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

export class ConflictEngineService {
  detect(
    entries: EntryLike[],
    teacherAvailability: TeacherAvailability[] = [],
    roomAvailability: RoomAvailability[] = []
  ): TimetableConflict[] {
    const conflicts: TimetableConflict[] = [];

    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      if (minutes(left.startTime) >= minutes(left.endTime)) {
        conflicts.push({
          code: 'INVALID_TIME_RANGE', severity: 'ERROR', entryIds: [left.id],
          message: 'Lesson end time must be after its start time.',
          suggestedActions: ['Select a valid bell period', 'Correct the lesson start and end time'], canOverride: false
        });
      }

      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        if (left.day !== right.day || !overlaps(left, right)) continue;

        if (left.classId === right.classId) {
          conflicts.push({
            code: 'CLASS_CLASH', severity: 'ERROR', entryIds: [left.id, right.id],
            message: 'A class has overlapping lessons.',
            suggestedActions: ['Move one lesson', 'Swap one lesson with a free period'], canOverride: false
          });
        }
        if (left.teacherId && left.teacherId === right.teacherId) {
          conflicts.push({
            code: 'TEACHER_CLASH', severity: 'ERROR', entryIds: [left.id, right.id],
            message: 'A teacher is assigned to overlapping lessons.',
            suggestedActions: ['Move one lesson', 'Assign another qualified teacher'], canOverride: false
          });
        }
        if (left.roomId && left.roomId === right.roomId) {
          conflicts.push({
            code: 'ROOM_CLASH', severity: 'ERROR', entryIds: [left.id, right.id],
            message: 'A room is assigned to overlapping lessons.',
            suggestedActions: ['Move one lesson', 'Select another suitable room'], canOverride: false
          });
        }
      }

      if (left.teacherId && teacherAvailability.some(rule =>
        rule.teacherId === left.teacherId && rule.day === left.day && !rule.available && overlaps(left, rule)
      )) {
        conflicts.push({
          code: 'TEACHER_UNAVAILABLE', severity: 'ERROR', entryIds: [left.id],
          message: 'The assigned teacher is unavailable during this period.',
          suggestedActions: ['Move the lesson', 'Assign another qualified teacher'], canOverride: false
        });
      }

      if (left.roomId && roomAvailability.some(rule =>
        rule.roomId === left.roomId && rule.day === left.day && !rule.available && overlaps(left, rule)
      )) {
        conflicts.push({
          code: 'ROOM_UNAVAILABLE', severity: 'ERROR', entryIds: [left.id],
          message: 'The selected room is unavailable during this period.',
          suggestedActions: ['Move the lesson', 'Select another suitable room'], canOverride: false
        });
      }
    }

    return conflicts;
  }
}

export const conflictEngine = new ConflictEngineService();
