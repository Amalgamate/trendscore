const databaseMock = {
  user: { findUnique: jest.fn() },
  learner: { findUnique: jest.fn() },
  learnerPathwaySelection: { findUnique: jest.fn() },
};

jest.mock('../config/database', () => ({
  __esModule: true,
  default: databaseMock,
}));

jest.mock('../services/parent-access.service', () => ({
  parentAccessService: { canAccessLearner: jest.fn() },
}));

import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  assertLearnerPathwayAccess,
  requirePathwaySelectionAccess,
} from '../middleware/pathwayAccess.middleware';
import { parentAccessService } from '../services/parent-access.service';

const parentAccessMock = parentAccessService as unknown as {
  canAccessLearner: jest.Mock;
};

const requestFor = (role: string, userId = 'user-1') => ({
  user: { userId, email: 'user@example.test', role, roles: [role] },
}) as unknown as AuthRequest;

describe('pathway learner access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows a student to access only the learner linked to their username', async () => {
    databaseMock.user.findUnique.mockResolvedValue({ username: 'ADM-001' });
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });

    await expect(
      assertLearnerPathwayAccess(requestFor('STUDENT'), 'learner-1'),
    ).resolves.toBeUndefined();
    await expect(
      assertLearnerPathwayAccess(requestFor('STUDENT'), 'learner-2'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('uses the shared family-link service for parent access', async () => {
    parentAccessMock.canAccessLearner.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      assertLearnerPathwayAccess(requestFor('PARENT', 'parent-1'), 'learner-1'),
    ).resolves.toBeUndefined();
    await expect(
      assertLearnerPathwayAccess(requestFor('PARENT', 'parent-1'), 'learner-2'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('denies authenticated roles that have no pathway case permission', async () => {
    await expect(
      assertLearnerPathwayAccess(requestFor('ACCOUNTANT'), 'learner-1'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('recognizes the formal Head of Curriculum counsellor proxy', async () => {
    await expect(
      assertLearnerPathwayAccess(requestFor('HEAD_OF_CURRICULUM'), 'learner-1'),
    ).resolves.toBeUndefined();
  });

  it('applies learner ownership to selection-id history routes', async () => {
    databaseMock.learnerPathwaySelection.findUnique.mockResolvedValue({ learnerId: 'learner-2' });
    databaseMock.user.findUnique.mockResolvedValue({ username: 'ADM-001' });
    databaseMock.learner.findUnique.mockResolvedValue({ id: 'learner-1' });
    const req = {
      ...requestFor('STUDENT'),
      params: { id: 'selection-1' },
    } as unknown as AuthRequest;
    const next: NextFunction = jest.fn();

    await requirePathwaySelectionAccess(req, {} as Response, next);

    expect((next as jest.Mock).mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
});

