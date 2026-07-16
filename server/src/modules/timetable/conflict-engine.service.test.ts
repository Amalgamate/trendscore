import { conflictEngine } from './conflict-engine.service';

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry-a', classId: 'class-a', teacherId: 'teacher-a', roomId: 'room-a',
  day: 'Monday', startTime: '08:00', endTime: '08:40', ...overrides
});

describe('ConflictEngineService', () => {
  it('detects class, teacher and room overlaps', () => {
    const conflicts = conflictEngine.detect([
      entry(),
      entry({ id: 'entry-b', startTime: '08:20', endTime: '09:00' })
    ] as any);

    expect(conflicts.map(item => item.code)).toEqual(expect.arrayContaining([
      'CLASS_CLASH', 'TEACHER_CLASH', 'ROOM_CLASH'
    ]));
  });

  it('does not report adjacent lessons as overlapping', () => {
    const conflicts = conflictEngine.detect([
      entry(),
      entry({ id: 'entry-b', startTime: '08:40', endTime: '09:20' })
    ] as any);
    expect(conflicts).toHaveLength(0);
  });

  it('detects teacher unavailability', () => {
    const conflicts = conflictEngine.detect(
      [entry()] as any,
      [{ teacherId: 'teacher-a', day: 'Monday', startTime: '07:30', endTime: '09:00', available: false }] as any
    );
    expect(conflicts.some(item => item.code === 'TEACHER_UNAVAILABLE')).toBe(true);
  });

  it('rejects invalid time ranges', () => {
    const conflicts = conflictEngine.detect([entry({ startTime: '09:00', endTime: '08:00' })] as any);
    expect(conflicts.some(item => item.code === 'INVALID_TIME_RANGE')).toBe(true);
  });
});
