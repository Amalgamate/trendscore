jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    learner: { findMany: jest.fn() },
    notice: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    messageReceipt: { findMany: jest.fn() },
    userNotification: { findMany: jest.fn() },
  },
}));

jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('../services/parent-access.service', () => ({
  parentAccessService: {
    getAccessibleLearnerIds: jest.fn(),
  },
}));

import type { Response } from 'express';
import prisma from '../config/database';
import { redisCacheService } from '../services/redis-cache.service';
import { parentAccessService } from '../services/parent-access.service';
import { DashboardController } from '../controllers/dashboard.controller';
import type { AuthRequest } from '../middleware/permissions.middleware';

const mockedPrisma = prisma as unknown as {
  learner: { findMany: jest.Mock };
  notice: { count: jest.Mock; findMany: jest.Mock };
  messageReceipt: { findMany: jest.Mock };
  userNotification: { findMany: jest.Mock };
};
const mockedRedis = redisCacheService as unknown as { get: jest.Mock; set: jest.Mock };
const mockedParentAccessService = parentAccessService as unknown as {
  getAccessibleLearnerIds: jest.Mock;
};

describe('DashboardController parent access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRedis.get.mockResolvedValue(null);
    mockedRedis.set.mockResolvedValue(undefined);
    mockedParentAccessService.getAccessibleLearnerIds.mockResolvedValue(['direct-1', 'family-1']);
    mockedPrisma.learner.findMany.mockResolvedValue([]);
    mockedPrisma.notice.count.mockResolvedValue(0);
    mockedPrisma.notice.findMany.mockResolvedValue([]);
    mockedPrisma.messageReceipt.findMany.mockResolvedValue([]);
    mockedPrisma.userNotification.findMany.mockResolvedValue([]);
  });

  it('queries parent dashboard learners by shared accessible learner ids', async () => {
    const controller = new DashboardController();
    const req = {
      user: { userId: 'parent-1', email: 'p@example.test', role: 'PARENT', roles: ['PARENT'] },
    } as unknown as AuthRequest;
    const res = {
      json: jest.fn(),
    } as unknown as Response;

    await controller.getParentMetrics(req, res);

    expect(mockedParentAccessService.getAccessibleLearnerIds).toHaveBeenCalledWith('parent-1');
    expect(mockedPrisma.learner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['direct-1', 'family-1'] }, archived: false },
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
