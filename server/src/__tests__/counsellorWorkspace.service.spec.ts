const databaseMock: any = {
  learner: { findUnique: jest.fn() },
  decisionPlan: { findUnique: jest.fn(), groupBy: jest.fn() },
  learnerActionPlan: { findUnique: jest.fn(), upsert: jest.fn() },
  actionItem: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  counsellingSession: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  pathwayIntervention: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), groupBy: jest.fn() },
  learnerPathwaySelection: { groupBy: jest.fn() },
  pathway: { findMany: jest.fn() },
  user: { findUnique: jest.fn(), findMany: jest.fn() },
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: databaseMock,
}));

import {
  bulkUpdatePathwayInterventions,
  createCounsellorActionItem,
  escalatePathwayIntervention,
  updateCounsellingSession,
  updatePathwayIntervention,
} from '../services/counsellor-workspace.service';

describe('Counsellor workspace service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an action inside the learner existing decision action plan', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.decisionPlan.findUnique.mockResolvedValue({ id: 'decision-1' });
    databaseMock.learnerActionPlan.upsert.mockResolvedValue({ id: 'plan-1' });
    databaseMock.actionItem.create.mockResolvedValue({ id: 'action-1' });

    await createCounsellorActionItem({
      learnerId: 'learner-1',
      actorId: 'counsellor-1',
      title: 'Compare two subject combinations',
      assignedToRole: 'STUDENT',
      priority: 'HIGH',
    });

    expect(databaseMock.learnerActionPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { learnerId: 'learner-1' },
        create: expect.objectContaining({ decisionPlanId: 'decision-1' }),
      }),
    );
    expect(databaseMock.actionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionPlanId: 'plan-1',
        createdById: 'counsellor-1',
        priority: 'HIGH',
      }),
    });
  });

  it('requires an outcome before completing a counselling session', async () => {
    databaseMock.counsellingSession.findUnique.mockResolvedValue({ learnerId: 'learner-1' });

    await expect(updateCounsellingSession({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      status: 'COMPLETED',
    })).rejects.toMatchObject({ statusCode: 422 });

    expect(databaseMock.counsellingSession.update).not.toHaveBeenCalled();
  });

  it('prevents updating an intervention through another learner case', async () => {
    databaseMock.pathwayIntervention.findUnique.mockResolvedValue({ learnerId: 'learner-2' });

    await expect(updatePathwayIntervention({
      learnerId: 'learner-1',
      interventionId: 'intervention-1',
      status: 'RESOLVED',
      outcome: 'Resolved after family meeting',
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(databaseMock.pathwayIntervention.update).not.toHaveBeenCalled();
  });

  it('requires outcome-safe individual handling for bulk resolution', async () => {
    await expect(bulkUpdatePathwayInterventions({
      interventionIds: ['intervention-1'],
      status: 'RESOLVED',
    })).rejects.toMatchObject({ statusCode: 422 });

    expect(databaseMock.pathwayIntervention.updateMany).not.toHaveBeenCalled();
  });

  it('escalates an owned intervention with urgent priority and actor context', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.pathwayIntervention.findUnique.mockResolvedValue({ learnerId: 'learner-1' });
    databaseMock.pathwayIntervention.update.mockResolvedValue({ id: 'intervention-1' });

    await escalatePathwayIntervention({
      learnerId: 'learner-1',
      interventionId: 'intervention-1',
      actorId: 'counsellor-1',
      reason: 'No valid combination remains after repeated review.',
    });

    expect(databaseMock.pathwayIntervention.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ESCALATED',
          priority: 'URGENT',
          escalatedById: 'counsellor-1',
        }),
      }),
    );
  });
});
