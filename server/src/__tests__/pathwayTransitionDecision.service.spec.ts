const databaseMock = {
  learner: { findUnique: jest.fn() },
  learnerPathwayRecommendation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: databaseMock,
}));

import {
  getTransitionDecisionHistory,
  hasFinalizedTransitionDecision,
  saveTransitionDecision,
} from '../services/pathway-transition-decision.service';

describe('pathway transition decision Prisma persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('preserves append-only recommendation history through Prisma create', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.learnerPathwayRecommendation.create.mockResolvedValue({ id: 'decision-1' });

    await saveTransitionDecision({
      learnerId: 'learner-1',
      recommendedPathway: 'STEM',
      confidenceScore: 82,
      updatedBy: 'staff-1',
    });

    expect(databaseMock.learnerPathwayRecommendation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        learnerId: 'learner-1',
        recommendedPathway: 'STEM',
        confidenceScore: 82,
        updatedBy: 'staff-1',
      }),
    });
  });

  it('returns the newest 30 decisions', async () => {
    databaseMock.learnerPathwayRecommendation.findMany.mockResolvedValue([]);
    await getTransitionDecisionHistory('learner-1');
    expect(databaseMock.learnerPathwayRecommendation.findMany).toHaveBeenCalledWith({
      where: { learnerId: 'learner-1' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  });

  it('checks finalized decisions without raw SQL', async () => {
    databaseMock.learnerPathwayRecommendation.findFirst.mockResolvedValue({ id: 'decision-1' });
    await expect(hasFinalizedTransitionDecision('learner-1')).resolves.toBe(true);
    expect(databaseMock.learnerPathwayRecommendation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ learnerId: 'learner-1' }) }),
    );
  });
});

