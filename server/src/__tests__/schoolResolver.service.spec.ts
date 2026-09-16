/**
 * Unit tests for school-resolver.service.ts
 * TRENDSCORE_EREPORT_ENGINE_CHECKLIST.md — Phase 12 (Automated Testing)
 *
 * This is the single shared implementation that replaced three independent,
 * divergent copies of "resolve the current school" (session 5 fix). These
 * tests pin down the exact query shape so a future edit can't silently drift
 * one of its call sites out of sync again.
 */

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    school: {
      findFirst: jest.fn(),
    },
  },
}));

import prisma from '../config/database';
import { resolveCurrentSchool } from '../services/school-resolver.service';

const mockedPrisma = prisma as unknown as {
  school: { findFirst: jest.Mock };
};

const EXPECTED_QUERY = {
  where: { archived: false },
  orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
};

describe('school-resolver.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries the default prisma client for the one active, non-archived School row', async () => {
    const fakeSchool = { id: 'school-1', reportEngine: 'NEW' };
    mockedPrisma.school.findFirst.mockResolvedValue(fakeSchool);

    const result = await resolveCurrentSchool();

    expect(result).toBe(fakeSchool);
    expect(mockedPrisma.school.findFirst).toHaveBeenCalledWith(EXPECTED_QUERY);
  });

  it('uses a supplied client instead of the default (transaction support)', async () => {
    const txSchool = { id: 'school-tx' };
    const txClient = { school: { findFirst: jest.fn().mockResolvedValue(txSchool) } };

    const result = await resolveCurrentSchool(txClient);

    expect(result).toBe(txSchool);
    expect(txClient.school.findFirst).toHaveBeenCalledWith(EXPECTED_QUERY);
    expect(mockedPrisma.school.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when no non-archived School row exists', async () => {
    mockedPrisma.school.findFirst.mockResolvedValue(null);
    await expect(resolveCurrentSchool()).resolves.toBeNull();
  });

  it('orders active schools first, then most recently updated, then most recently created', async () => {
    mockedPrisma.school.findFirst.mockResolvedValue({ id: 'school-1' });

    await resolveCurrentSchool();

    const [{ orderBy }] = mockedPrisma.school.findFirst.mock.calls[0];
    expect(orderBy).toEqual([{ active: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]);
  });
});
