jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    learner: { findMany: jest.fn(), updateMany: jest.fn() },
    class: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    classEnrollment: { findMany: jest.fn(), updateMany: jest.fn(), createMany: jest.fn() },
    changeHistory: { create: jest.fn() },
    stream: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '../config/database';
import { learnerController } from '../controllers/learner.controller';
import { configController } from '../controllers/config.controller';
import { buildPromotionReadiness, getPromotionGrades } from '../services/promotionReadiness.service';

const db = prisma as any;
const baseReq = (body: any = {}) => ({
  body,
  query: {},
  user: { userId: 'admin-1' },
  resolvedInstitutionType: 'PRIMARY_CBC',
} as any);

const makeRes = () => {
  const res: any = {};
  res.json = jest.fn(() => res);
  res.status = jest.fn(() => res);
  return res;
};

const resetMocks = () => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation(async (callback: any) => callback(db));
};

describe('promotion readiness', () => {
  beforeEach(resetMocks);

  it('lists the grades a primary school can promote into', () => {
    expect(getPromotionGrades('PRIMARY_CBC')).toEqual([
      'PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3',
      'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9',
    ]);
  });

  it('reports missing destination classes and stale enrollments', async () => {
    db.learner.findMany.mockResolvedValue([
      { grade: 'GRADE_1', stream: 'A' },
      { grade: 'GRADE_2', stream: 'A' },
    ]);
    db.class.findMany.mockResolvedValue([]);
    db.classEnrollment.findMany.mockResolvedValue([{ id: 'stale-1' }, { id: 'stale-2' }]);

    const result = await buildPromotionReadiness({
      institutionType: 'PRIMARY_CBC',
      targetAcademicYear: 2027,
      targetTerm: 'TERM_1',
    });

    expect(result.activeLearnerCount).toBe(2);
    expect(result.staleEnrollmentCount).toBe(2);
    expect(result.missingClasses).toEqual([
      { grade: 'GRADE_2', stream: 'A' },
      { grade: 'GRADE_3', stream: 'A' },
    ]);
    expect(result.messages.join(' ')).toContain('active enrollments');
  });

  it('flags a capacity risk for a top-down move', async () => {
    db.learner.findMany.mockResolvedValue([
      { grade: 'GRADE_1', stream: 'A' },
      { grade: 'GRADE_1', stream: 'A' },
      { grade: 'GRADE_1', stream: 'A' },
    ]);
    db.class.findMany.mockResolvedValue([
      { grade: 'GRADE_2', stream: 'A', capacity: 2, _count: { enrollments: 0 } },
    ]);
    db.classEnrollment.findMany.mockResolvedValue([]);

    const result = await buildPromotionReadiness({
      institutionType: 'PRIMARY_CBC',
      targetAcademicYear: 2027,
      targetTerm: 'TERM_1',
    });
    const step = result.steps.find((item) => item.from === 'GRADE_1');

    expect(step?.issue).toContain('capacity 2');
    expect(step?.projectedEnrollment).toBe(3);
    expect(result.suggestedOrder[0]).toBe('GRADE_9 → GRADUATED');
  });
});

describe('promotion apply', () => {
  beforeEach(resetMocks);

  const learnerRows = [
    { id: 'learner-1', firstName: 'Ava', lastName: 'One', admissionNumber: 'ADM-1', grade: 'GRADE_1', stream: 'A', status: 'ACTIVE' },
    { id: 'learner-2', firstName: 'Ben', lastName: 'Two', admissionNumber: 'ADM-2', grade: 'GRADE_1', stream: 'A', status: 'ACTIVE' },
  ];

  it('re-runs preview inside the transaction and records per-learner history', async () => {
    db.learner.findMany.mockResolvedValue(learnerRows);
    db.class.findMany.mockResolvedValue([
      { id: 'class-2', name: 'Grade 2 A', grade: 'GRADE_2', stream: 'A', capacity: 40,
        _count: { enrollments: 0 } },
    ]);
    db.classEnrollment.findMany.mockResolvedValue([]);
    const res = makeRes();

    await learnerController.promoteLearners(baseReq({
      learnerIds: ['learner-1', 'learner-2'],
      sourceGrade: 'GRADE_1',
      targetGrade: 'GRADE_2',
      targetAcademicYear: 2027,
      targetTerm: 'TERM_1',
    }), res);

    expect(db.learner.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['learner-1', 'learner-2'] } },
      data: { grade: 'GRADE_2', updatedBy: 'admin-1' },
    });
    expect(db.changeHistory.create).toHaveBeenCalledTimes(2);
    expect(db.changeHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityType: 'Learner',
        entityId: 'learner-1',
        action: 'BULK_PROMOTE_LEARNER',
        oldValue: 'GRADE_1',
        newValue: 'GRADE_2',
      }),
    }));
    expect(res.json.mock.calls[0][0].data.learnerIds).toEqual(['learner-1', 'learner-2']);
  });

  it('records graduation history and closes enrollments', async () => {
    db.learner.findMany.mockResolvedValue([learnerRows[0]]);
    const res = makeRes();

    await learnerController.promoteLearners(baseReq({
      learnerIds: ['learner-1'],
      sourceGrade: 'GRADE_1',
      targetGrade: 'GRADUATED',
      targetAcademicYear: 2027,
      targetTerm: 'TERM_1',
    }), res);

    expect(db.learner.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['learner-1'] } },
      data: expect.objectContaining({ status: 'GRADUATED', exitReason: 'Graduated', updatedBy: 'admin-1' }),
    });
    expect(db.changeHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'BULK_GRADUATE_LEARNER', entityId: 'learner-1' }),
    }));
  });

  it('rejects blocked placements without writing anything', async () => {
    db.learner.findMany.mockResolvedValue([]);
    db.class.findMany.mockResolvedValue([]);
    const res = makeRes();

    await learnerController.promoteLearners(baseReq({
      learnerIds: ['missing-learner'],
      sourceGrade: 'GRADE_1',
      targetGrade: 'GRADE_2',
      targetAcademicYear: 2027,
      targetTerm: 'TERM_1',
    }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(db.learner.updateMany).not.toHaveBeenCalled();
    expect(db.changeHistory.create).not.toHaveBeenCalled();
  });

  it('clears non-active learners\' enrollments and audits each one', async () => {
    db.classEnrollment.findMany.mockResolvedValue([
      { id: 'enr-1', learnerId: 'dropped-1', classId: 'class-1' },
    ]);
    const res = makeRes();

    await learnerController.cleanupStaleEnrollments(baseReq({ reason: 'Test cleanup' }), res);

    expect(db.classEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['enr-1'] } },
      data: { active: false },
    });
    expect(db.changeHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'STALE_ENROLLMENT_CLEANUP', entityId: 'enr-1' }),
    }));
    expect(res.json.mock.calls[0][0].data.cleared).toBe(1);
  });
});

describe('destination class creation', () => {
  beforeEach(resetMocks);

  it('creates classes only for the requested year and does not enrol learners', async () => {
    db.stream.findMany.mockResolvedValue([{ name: 'A' }]);
    db.class.findFirst.mockResolvedValue(null);
    db.class.findUnique.mockResolvedValue(null);
    db.class.findMany.mockResolvedValue([]);
    db.class.create.mockImplementation(async ({ data }: any) => ({ id: `created-${data.grade}`, ...data }));
    const res = makeRes();

    await configController.bulkCreateYearClasses(baseReq({
      academicYear: 2027,
      term: 'TERM_1',
      capacity: 45,
    }), res);

    expect(db.class.create).toHaveBeenCalledTimes(12);
    expect(db.class.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ academicYear: 2027, term: 'TERM_1', capacity: 45, stream: 'A' }),
    }));
    expect(db.classEnrollment.createMany).not.toHaveBeenCalled();
  });
});
