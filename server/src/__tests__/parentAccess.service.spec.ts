jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    learner: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    familyMember: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../config/database';
import { ParentAccessService } from '../services/parent-access.service';

const mockedPrisma = prisma as unknown as {
  learner: { findMany: jest.Mock; findUnique: jest.Mock };
  familyMember: { findUnique: jest.Mock };
};

describe('ParentAccessService', () => {
  let service: ParentAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ParentAccessService();
  });

  it('allows access to direct parentId learners', async () => {
    mockedPrisma.learner.findUnique.mockResolvedValue({
      id: 'learner-1',
      parentId: 'parent-1',
      archived: false,
    });

    await expect(service.canAccessLearner('parent-1', 'learner-1')).resolves.toBe(true);
    expect(mockedPrisma.familyMember.findUnique).not.toHaveBeenCalled();
  });

  it('allows access through active family membership and learner link', async () => {
    mockedPrisma.learner.findUnique.mockResolvedValue({
      id: 'learner-1',
      parentId: 'other-parent',
      archived: false,
    });
    mockedPrisma.familyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      canLogin: true,
      canViewReports: true,
      familyAccount: {
        status: 'ACTIVE',
        archived: false,
        learners: [{ learnerId: 'learner-1' }],
      },
    });

    await expect(service.canAccessLearner('parent-1', 'learner-1')).resolves.toBe(true);
  });

  it('rejects unrelated learners', async () => {
    mockedPrisma.learner.findUnique.mockResolvedValue({
      id: 'learner-1',
      parentId: 'other-parent',
      archived: false,
    });
    mockedPrisma.familyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      canLogin: true,
      canViewReports: true,
      familyAccount: {
        status: 'ACTIVE',
        archived: false,
        learners: [],
      },
    });

    await expect(service.canAccessLearner('parent-1', 'learner-1')).resolves.toBe(false);
  });

  it('combines direct and family-linked learner ids without duplicates', async () => {
    mockedPrisma.learner.findMany.mockResolvedValue([
      { id: 'direct-1' },
      { id: 'shared-1' },
    ]);
    mockedPrisma.familyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      canLogin: true,
      canViewReports: true,
      familyAccount: {
        status: 'ACTIVE',
        archived: false,
        learners: [{ learnerId: 'shared-1' }, { learnerId: 'family-1' }],
      },
    });

    await expect(service.getAccessibleLearnerIds('parent-1')).resolves.toEqual([
      'direct-1',
      'shared-1',
      'family-1',
    ]);
  });

  it('falls back to direct learners when family tables are absent', async () => {
    mockedPrisma.learner.findMany.mockResolvedValue([{ id: 'direct-1' }]);
    mockedPrisma.familyMember.findUnique.mockRejectedValue({
      code: 'P2021',
      meta: { table: 'public.family_members' },
    });

    await expect(service.getAccessibleLearnerIds('parent-1')).resolves.toEqual(['direct-1']);
  });
});
