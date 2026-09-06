jest.mock('../../config/database', () => {
  const prisma = {
    timetableVersion: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn()
    },
    class: { findMany: jest.fn() },
    instructionalAllocation: { findMany: jest.fn() },
    subjectAssignment: { findMany: jest.fn() },
    timetableRoom: { findMany: jest.fn() },
    roomAvailability: { findMany: jest.fn() },
    teacherAvailability: { findMany: jest.fn() },
    timetableEntry: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn((operations: any) => Promise.all(operations))
  };
  return { __esModule: true, default: prisma };
});

jest.mock('./conflict-engine.service', () => ({
  conflictEngine: { detect: jest.fn(() => []) }
}));

import prisma from '../../config/database';
import { automaticGeneratorService } from './automatic-generator.service';

const mockedPrisma = prisma as unknown as Record<string, any>;

const period = (id: string, sequence: number, startTime: string, endTime: string) => ({
  id, sequence, startTime, endTime, active: true, instructional: true, type: 'LESSON'
});

const version = {
  id: 'version-1',
  status: 'DRAFT',
  plan: {
    academicYear: 2026,
    term: 'TERM_1',
    bellSchedule: {
      periods: [
        period('p1', 1, '08:00', '08:40'),
        period('p2', 2, '08:40', '09:20'),
        period('p3', 3, '10:00', '10:40'),
        period('p4', 4, '10:40', '11:20'),
        period('p5', 5, '11:20', '12:00')
      ]
    }
  },
  entries: []
};

const classes = [
  { id: 'class-1', name: '7A', grade: 'GRADE_7', stream: 'A', active: true, archived: false },
  { id: 'class-2', name: '7B', grade: 'GRADE_7', stream: 'B', active: true, archived: false }
];

const allocation = (id: string, learningAreaId: string, targetWeeklyPeriods: number, extra: Record<string, unknown> = {}) => ({
  id, academicYear: 2026, grade: 'GRADE_7', learningAreaId, targetWeeklyPeriods,
  requiresDouble: false, requiredRoomType: null, active: true,
  learningArea: { id: learningAreaId, name: learningAreaId === 'area-1' ? 'Mathematics' : 'English' },
  ...extra
});

const assignment = (id: string, learningAreaId: string, teacherId: string) => ({
  id, active: true, grade: 'GRADE_7', learningAreaId, teacherId,
  teacher: { id: teacherId, firstName: 'T', lastName: teacherId }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.timetableVersion.findUniqueOrThrow.mockResolvedValue(version);
  mockedPrisma.class.findMany.mockResolvedValue(classes);
  mockedPrisma.instructionalAllocation.findMany.mockResolvedValue([
    allocation('al-1', 'area-1', 3),
    allocation('al-2', 'area-2', 3)
  ]);
  mockedPrisma.subjectAssignment.findMany.mockResolvedValue([
    assignment('sa-1', 'area-1', 'teacher-1'),
    assignment('sa-2', 'area-2', 'teacher-2')
  ]);
  mockedPrisma.timetableRoom.findMany.mockResolvedValue([]);
  mockedPrisma.roomAvailability.findMany.mockResolvedValue([]);
  mockedPrisma.teacherAvailability.findMany.mockResolvedValue([]);
  mockedPrisma.timetableEntry.deleteMany.mockResolvedValue({});
  mockedPrisma.timetableEntry.createMany.mockResolvedValue({});
  mockedPrisma.timetableEntry.findMany.mockResolvedValue([]);
  mockedPrisma.timetableVersion.update.mockResolvedValue({});
});

const createdEntries = () => mockedPrisma.timetableEntry.createMany.mock.calls.flatMap(
  (call: any[]) => call[0].data
);

const fingerprint = (entries: any[]) => entries.map((entry: any) =>
  [entry.classId, entry.day, entry.startTime, entry.learningAreaId, entry.teacherId].join('|')
);

describe('AutomaticGeneratorService.generate', () => {
  it('schedules every allocated period without conflicts or unresolved allocations', async () => {
    const result = await automaticGeneratorService.generate('version-1', { randomSeed: 42 });

    expect(result.stats.requiredPeriods).toBe(12); // 2 classes x (3 + 3)
    expect(result.stats.generatedEntries).toBe(12);
    expect(result.stats.unresolvedAllocations).toBe(0);
    expect(result.stats.hardConflicts).toBe(0);
    expect(result.unresolved).toHaveLength(0);
  });

  it('never double-books a class, even across learning areas', async () => {
    await automaticGeneratorService.generate('version-1', { randomSeed: 7 });

    const seen = new Set<string>();
    for (const entry of createdEntries()) {
      const key = `${entry.classId}|${entry.day}|${entry.startTime}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('is reproducible for the same explicit seed', async () => {
    await automaticGeneratorService.generate('version-1', { randomSeed: 123 });
    const first = fingerprint(createdEntries());

    jest.clearAllMocks();
    mockedPrisma.timetableVersion.findUniqueOrThrow.mockResolvedValue(version);
    mockedPrisma.class.findMany.mockResolvedValue(classes);
    mockedPrisma.instructionalAllocation.findMany.mockResolvedValue([
      allocation('al-1', 'area-1', 3),
      allocation('al-2', 'area-2', 3)
    ]);
    mockedPrisma.subjectAssignment.findMany.mockResolvedValue([
      assignment('sa-1', 'area-1', 'teacher-1'),
      assignment('sa-2', 'area-2', 'teacher-2')
    ]);
    mockedPrisma.timetableRoom.findMany.mockResolvedValue([]);
    mockedPrisma.roomAvailability.findMany.mockResolvedValue([]);
    mockedPrisma.teacherAvailability.findMany.mockResolvedValue([]);
    mockedPrisma.timetableEntry.deleteMany.mockResolvedValue({});
    mockedPrisma.timetableEntry.createMany.mockResolvedValue({});
    mockedPrisma.timetableEntry.findMany.mockResolvedValue([]);
    mockedPrisma.timetableVersion.update.mockResolvedValue({});

    await automaticGeneratorService.generate('version-1', { randomSeed: 123 });
    expect(fingerprint(createdEntries())).toEqual(first);
  });

  it('derives a stable default seed from the version id', async () => {
    await automaticGeneratorService.generate('version-1');
    const first = fingerprint(createdEntries());

    jest.clearAllMocks();
    mockedPrisma.timetableVersion.findUniqueOrThrow.mockResolvedValue(version);
    mockedPrisma.class.findMany.mockResolvedValue(classes);
    mockedPrisma.instructionalAllocation.findMany.mockResolvedValue([
      allocation('al-1', 'area-1', 3),
      allocation('al-2', 'area-2', 3)
    ]);
    mockedPrisma.subjectAssignment.findMany.mockResolvedValue([
      assignment('sa-1', 'area-1', 'teacher-1'),
      assignment('sa-2', 'area-2', 'teacher-2')
    ]);
    mockedPrisma.timetableRoom.findMany.mockResolvedValue([]);
    mockedPrisma.roomAvailability.findMany.mockResolvedValue([]);
    mockedPrisma.teacherAvailability.findMany.mockResolvedValue([]);
    mockedPrisma.timetableEntry.deleteMany.mockResolvedValue({});
    mockedPrisma.timetableEntry.createMany.mockResolvedValue({});
    mockedPrisma.timetableEntry.findMany.mockResolvedValue([]);
    mockedPrisma.timetableVersion.update.mockResolvedValue({});

    await automaticGeneratorService.generate('version-1');
    expect(fingerprint(createdEntries())).toEqual(first);
  });

  it('respects teacher unavailability blackouts', async () => {
    mockedPrisma.teacherAvailability.findMany.mockResolvedValue([
      { teacherId: 'teacher-1', day: 'Monday', startTime: '00:00', endTime: '23:59', available: false }
    ]);

    const result = await automaticGeneratorService.generate('version-1', { randomSeed: 42 });

    const mondayTeacher1 = createdEntries().filter((entry: any) =>
      entry.teacherId === 'teacher-1' && entry.day === 'Monday');
    expect(mondayTeacher1).toHaveLength(0);
    expect(result.stats.unresolvedAllocations).toBe(0);
  });

  it('reports a soft warning when a class repeats the same learning area in one day', async () => {
    // More required periods than available slots per day forces repeats.
    mockedPrisma.instructionalAllocation.findMany.mockResolvedValue([
      allocation('al-1', 'area-1', 8)
    ]);

    const result = await automaticGeneratorService.generate('version-1', { randomSeed: 42 });

    expect(result.stats.softWarnings.some((warning: string) => warning.includes('same learning area'))).toBe(true);
  });
});
