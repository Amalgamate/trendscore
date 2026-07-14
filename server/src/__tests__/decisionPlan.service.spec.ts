const databaseMock: any = {
  $transaction: jest.fn(),
  learnerPathwaySelection: { findFirst: jest.fn() },
  learnerCareerSave: { findMany: jest.fn() },
  learnerSchoolPreference: { findMany: jest.fn() },
  learnerPathwayRecommendation: { findFirst: jest.fn() },
  learnerSchoolSearchCriteria: { findUnique: jest.fn() },
  decisionPlan: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  decisionPlanSubmission: { create: jest.fn() },
  decisionPlanRevision: { create: jest.fn(), updateMany: jest.fn() },
  parentComment: { create: jest.fn() },
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: databaseMock,
}));

import { DecisionPlanStatus } from '@prisma/client';
import {
  approveDecisionPlan,
  assertDecisionPlanState,
  getDecisionPlan,
  reviewDecisionPlanAsParent,
  submitDecisionPlan,
} from '../services/decision-plan.service';

describe('Decision Plan lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    databaseMock.$transaction.mockImplementation((callback: any) => callback(databaseMock));
  });

  it('rejects invalid state transitions', () => {
    expect(() => assertDecisionPlanState(
      DecisionPlanStatus.LOCKED,
      [DecisionPlanStatus.DRAFT],
      'submit',
    )).toThrow('Cannot submit a decision plan while it is LOCKED');
  });

  it('does not expose counsellor-only parent comments to students', async () => {
    databaseMock.decisionPlan.findUnique.mockResolvedValue(null);

    await getDecisionPlan('learner-1', { actorId: 'student-1', role: 'STUDENT' });

    expect(databaseMock.decisionPlan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          comments: expect.objectContaining({
            where: { visibility: 'SHARED_WITH_STUDENT' },
          }),
        }),
      }),
    );
  });

  it('creates an immutable versioned snapshot when a complete plan is submitted', async () => {
    databaseMock.learnerPathwaySelection.findFirst.mockResolvedValue({
      id: 'selection-1',
      status: 'DRAFT',
      pathway: { id: 'pathway-1', code: 'STEM', name: 'STEM' },
      track: { id: 'track-1', code: 'PURE', name: 'Pure Sciences' },
      combinationRule: { id: 'combo-1', code: 'BIO-CHEM', name: 'Biology and Chemistry' },
      items: [{
        subjectType: 'ELECTIVE',
        officialLearningArea: { id: 'subject-1', officialCode: 'BIO', officialName: 'Biology' },
      }],
    });
    databaseMock.learnerCareerSave.findMany.mockResolvedValue([]);
    databaseMock.learnerSchoolPreference.findMany.mockResolvedValue([]);
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue(null);
    databaseMock.learnerSchoolSearchCriteria.findUnique.mockResolvedValue(null);
    databaseMock.decisionPlan.findUnique.mockResolvedValue(null);
    databaseMock.decisionPlan.create.mockResolvedValue({
      id: 'plan-1',
      learnerId: 'learner-1',
      status: DecisionPlanStatus.DRAFT,
      version: 0,
    });
    databaseMock.decisionPlanSubmission.create.mockResolvedValue({ id: 'submission-1' });
    databaseMock.decisionPlanRevision.updateMany.mockResolvedValue({ count: 0 });
    databaseMock.decisionPlan.update.mockResolvedValue({
      id: 'plan-1',
      status: DecisionPlanStatus.SUBMITTED,
      version: 1,
    });

    await submitDecisionPlan({
      learnerId: 'learner-1',
      actorId: 'student-1',
      learnerStatement: 'I want to study biological sciences.',
    });

    expect(databaseMock.decisionPlanSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decisionPlanId: 'plan-1',
        version: 1,
        submittedById: 'student-1',
        snapshot: expect.objectContaining({
          learnerStatement: 'I want to study biological sciences.',
          selection: expect.objectContaining({ id: 'selection-1' }),
        }),
      }),
    });
    expect(databaseMock.decisionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: DecisionPlanStatus.SUBMITTED, version: 1 }),
      }),
    );
  });

  it('requires complete revision instructions from a parent', async () => {
    databaseMock.decisionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      learnerId: 'learner-1',
      status: DecisionPlanStatus.SUBMITTED,
    });

    await expect(reviewDecisionPlanAsParent({
      learnerId: 'learner-1',
      actorId: 'parent-1',
      outcome: 'REQUEST_REVISION',
      revision: { explanation: 'Please reconsider the school list.' },
    })).rejects.toMatchObject({ statusCode: 422 });

    expect(databaseMock.decisionPlanRevision.create).not.toHaveBeenCalled();
  });

  it('records parent approval and blocks premature final approval', async () => {
    databaseMock.decisionPlan.findUnique.mockResolvedValueOnce({
      id: 'plan-1',
      learnerId: 'learner-1',
      status: DecisionPlanStatus.SUBMITTED,
    });
    databaseMock.decisionPlan.update.mockResolvedValue({
      id: 'plan-1',
      status: DecisionPlanStatus.PARENT_REVIEWED,
    });

    await reviewDecisionPlanAsParent({
      learnerId: 'learner-1',
      actorId: 'parent-1',
      outcome: 'APPROVE',
    });
    expect(databaseMock.decisionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DecisionPlanStatus.PARENT_REVIEWED,
          parentReviewedById: 'parent-1',
        }),
      }),
    );

    databaseMock.decisionPlan.findUnique.mockResolvedValueOnce({
      id: 'plan-1',
      status: DecisionPlanStatus.PARENT_REVIEWED,
    });
    await expect(approveDecisionPlan('learner-1', 'admin-1'))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
