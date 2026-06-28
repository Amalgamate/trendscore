jest.mock('../config/database', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/parent-access.service', () => ({
  parentAccessService: {
    canAccessLearner: jest.fn(),
  },
}));

import type { NextFunction, Response } from 'express';
import { ResourceAccessControl, type AuthRequest } from '../middleware/permissions.middleware';
import { parentAccessService } from '../services/parent-access.service';

const mockedParentAccessService = parentAccessService as unknown as {
  canAccessLearner: jest.Mock;
};

const makeRes = () => ({}) as Response;

describe('ResourceAccessControl parent family learner access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows parent learner access when the shared access service allows it', async () => {
    mockedParentAccessService.canAccessLearner.mockResolvedValue(true);
    const req = {
      method: 'GET',
      params: { id: 'learner-1' },
      user: { userId: 'parent-1', email: 'p@example.test', role: 'PARENT', roles: ['PARENT'] },
    } as unknown as AuthRequest;
    const next: NextFunction = jest.fn();

    await ResourceAccessControl.canAccessLearner()(req, makeRes(), next);

    expect(mockedParentAccessService.canAccessLearner).toHaveBeenCalledWith('parent-1', 'learner-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unrelated parent learner access', async () => {
    mockedParentAccessService.canAccessLearner.mockResolvedValue(false);
    const req = {
      method: 'GET',
      params: { id: 'learner-1' },
      user: { userId: 'parent-1', email: 'p@example.test', role: 'PARENT', roles: ['PARENT'] },
    } as unknown as AuthRequest;
    const next: NextFunction = jest.fn();

    await ResourceAccessControl.canAccessLearner()(req, makeRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next as jest.Mock).mock.calls[0][0].statusCode).toBe(403);
  });

  it('keeps teacher learner access behavior unchanged', async () => {
    const req = {
      method: 'PATCH',
      params: { id: 'learner-1' },
      user: { userId: 'teacher-1', email: 't@example.test', role: 'TEACHER', roles: ['TEACHER'] },
    } as unknown as AuthRequest;
    const next: NextFunction = jest.fn();

    await ResourceAccessControl.canAccessLearner()(req, makeRes(), next);

    expect(mockedParentAccessService.canAccessLearner).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
