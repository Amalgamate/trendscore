jest.mock('../../services/notification.service', () => ({
  NotificationService: {
    notifyRoles: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../config/database', () => {
  // In-memory store standing in for the DB row this file operates on.
  // updateMany() only "claims" the row while it is still PENDING, mirroring
  // the `WHERE id = ? AND status = 'PENDING'` guard the real query relies on.
  const store: { requests: Record<string, any> } = { requests: {} };

  const clone = (value: any) => (value ? JSON.parse(JSON.stringify(value)) : value);

  const applyInclude = (request: any) => ({
    ...request,
    class: { id: request.classId, name: 'Grade 7 East', grade: 'GRADE_7', stream: 'East' },
    learningArea: request.learningAreaId ? { id: request.learningAreaId, name: 'Mathematics', shortName: 'MAT' } : null,
    teacher: request.teacherId ? { id: request.teacherId, firstName: 'Jane', lastName: 'Doe' } : null,
    requestedBy: { id: request.requestedById, firstName: 'Sam', lastName: 'Requester' },
    reviewedBy: request.reviewedById ? { id: request.reviewedById, firstName: 'Ada', lastName: 'Reviewer' } : null
  });

  const timetableChangeRequest = {
    create: jest.fn(async ({ data }: any) => {
      const id = data.id || `req-${Object.keys(store.requests).length + 1}`;
      const record = { id, status: 'PENDING', reviewedById: null, reviewNote: null, reviewedAt: null, ...data };
      store.requests[id] = record;
      return applyInclude(clone(record));
    }),
    findMany: jest.fn(async () => Object.values(store.requests).map(r => applyInclude(clone(r)))),
    findUnique: jest.fn(async ({ where: { id } }: any) => (store.requests[id] ? applyInclude(clone(store.requests[id])) : null)),
    findUniqueOrThrow: jest.fn(async ({ where: { id } }: any) => {
      if (!store.requests[id]) throw new Error(`Not found: ${id}`);
      return applyInclude(clone(store.requests[id]));
    }),
    // The guard that makes concurrent approvals safe: only flips status while
    // the current stored status still matches what the caller expects.
    updateMany: jest.fn(async ({ where, data }: any) => {
      const record = store.requests[where.id];
      if (!record || record.status !== where.status) return { count: 0 };
      Object.assign(record, data);
      return { count: 1 };
    })
  };

  const classSchedule = {
    findFirst: jest.fn(async () => null), // no existing clash by default
    create: jest.fn(async ({ data }: any) => ({ id: 'schedule-1', ...data }))
  };

  const classModel = {
    findUniqueOrThrow: jest.fn(async ({ where: { id } }: any) => ({
      id, academicYear: 2026, term: 'TERM_1', grade: 'GRADE_7', stream: 'East'
    })),
    findFirst: jest.fn(async ({ where: { id } }: any) => ({ id, active: true, archived: false }))
  };

  const learningArea = {
    findUnique: jest.fn(async ({ where: { id } }: any) => (id ? { id, name: 'Mathematics' } : null))
  };

  const prismaMock: any = {
    timetableChangeRequest,
    classSchedule,
    class: classModel,
    learningArea,
    $transaction: jest.fn((fn: any) => fn(prismaMock)),
    __store: store
  };

  return { __esModule: true, default: prismaMock };
});

import prisma from '../../config/database';
import { timetableChangeRequestService } from './change-requests.service';

const mockedPrisma = prisma as unknown as { __store: { requests: Record<string, any> } };

const seedPendingRequest = (overrides: Record<string, unknown> = {}) => {
  const id = (overrides.id as string) || 'req-concurrent';
  mockedPrisma.__store.requests[id] = {
    id,
    classId: 'class-1',
    day: 'Monday',
    startTime: '08:00',
    endTime: '08:40',
    learningAreaId: 'area-1',
    teacherId: 'teacher-1',
    requestedById: 'requester-1',
    reason: 'Cover for a workshop',
    status: 'PENDING',
    reviewedById: null,
    reviewNote: null,
    reviewedAt: null,
    ...overrides
  };
  return id;
};

describe('TimetableChangeRequestService — approval concurrency safety', () => {
  beforeEach(() => {
    mockedPrisma.__store.requests = {};
    jest.clearAllMocks();
  });

  it('approves a single pending request and applies it as a ClassSchedule override', async () => {
    const id = seedPendingRequest();
    const result = await timetableChangeRequestService.approve(id, 'reviewer-1', 'Looks fine');
    expect(result.status).toBe('APPROVED');
    expect(mockedPrisma.__store.requests[id].status).toBe('APPROVED');
  });

  it('rejects a single pending request without touching ClassSchedule', async () => {
    const id = seedPendingRequest();
    const result = await timetableChangeRequestService.reject(id, 'reviewer-1', 'Not needed');
    expect(result.status).toBe('REJECTED');
  });

  it('only allows exactly one of two concurrent approvals on the same request to succeed', async () => {
    const id = seedPendingRequest();

    const outcomes = await Promise.allSettled([
      timetableChangeRequestService.approve(id, 'reviewer-a'),
      timetableChangeRequestService.approve(id, 'reviewer-b')
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/already reviewed/i);
    expect(mockedPrisma.__store.requests[id].status).toBe('APPROVED');
  });

  it('only allows exactly one of a concurrent approve+reject pair to succeed', async () => {
    const id = seedPendingRequest();

    const outcomes = await Promise.allSettled([
      timetableChangeRequestService.approve(id, 'reviewer-a'),
      timetableChangeRequestService.reject(id, 'reviewer-b', 'Conflicts with lab schedule')
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    expect(['APPROVED', 'REJECTED']).toContain(mockedPrisma.__store.requests[id].status);
  });

  it('rejects approval with a 409 when the requested time clashes with an existing lesson', async () => {
    const id = seedPendingRequest();
    (prisma as any).classSchedule.findFirst.mockResolvedValueOnce({
      id: 'existing-lesson', classId: 'class-1', startTime: '08:00', endTime: '08:40'
    });

    await expect(timetableChangeRequestService.approve(id, 'reviewer-a')).rejects.toThrow(/clashes with an existing lesson/i);
  });

  it('refuses to review a request that is already resolved', async () => {
    const id = seedPendingRequest({ status: 'APPROVED' });
    await expect(timetableChangeRequestService.approve(id, 'reviewer-a')).rejects.toThrow(/only a pending change request/i);
  });
});
