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

describe('saveTransitionDecision — versioned metadata', () => {
  beforeEach(() => jest.clearAllMocks());

  it('merges a server-stamped persistedAt onto a provided analysisPayload', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.learnerPathwayRecommendation.create.mockResolvedValue({ id: 'decision-1' });

    await saveTransitionDecision({
      learnerId: 'learner-1',
      recommendedPathway: 'STEM',
      confidenceScore: 75,
      analysisPayload: { version: 'GRADE9_READINESS_V1', generatedAt: '2026-08-01T00:00:00.000Z' },
      updatedBy: 'staff-1',
    });

    const created = databaseMock.learnerPathwayRecommendation.create.mock.calls[0][0];
    const payload = created.data.analysisPayload as Record<string, unknown>;
    expect(payload.version).toBe('GRADE9_READINESS_V1');
    expect(typeof payload.persistedAt).toBe('string');
    expect(payload.savedBy).toBe('staff-1');
    // Original fields must be preserved
    expect(payload.generatedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('creates a minimal version stub when recommendedPathway is set but no analysisPayload is given', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.learnerPathwayRecommendation.create.mockResolvedValue({ id: 'decision-2' });

    await saveTransitionDecision({
      learnerId: 'learner-1',
      recommendedPathway: 'ARTS_SPORTS',
      confidenceScore: 60,
      updatedBy: 'staff-1',
    });

    const created = databaseMock.learnerPathwayRecommendation.create.mock.calls[0][0];
    const payload = created.data.analysisPayload as Record<string, unknown>;
    expect(typeof payload.persistedAt).toBe('string');
    expect(payload.savedBy).toBe('staff-1');
  });

  it('leaves analysisPayload undefined for a parent-preference-only row (no pathway)', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.learnerPathwayRecommendation.create.mockResolvedValue({ id: 'decision-3' });

    await saveTransitionDecision({
      learnerId: 'learner-1',
      recommendedPathway: null,
      confidenceScore: 0,
      parentPreference: 'STEM',
    });

    const created = databaseMock.learnerPathwayRecommendation.create.mock.calls[0][0];
    expect(created.data.analysisPayload).toBeUndefined();
  });

  it('accepts recommendedPathway: null without throwing (nullable schema field)', async () => {
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    databaseMock.learnerPathwayRecommendation.create.mockResolvedValue({ id: 'decision-4' });

    await expect(
      saveTransitionDecision({ learnerId: 'learner-1', recommendedPathway: null, confidenceScore: 0 }),
    ).resolves.not.toThrow();

    const created = databaseMock.learnerPathwayRecommendation.create.mock.calls[0][0];
    expect(created.data.recommendedPathway).toBeNull();
  });
});

