jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    school: { findFirst: jest.fn(), findMany: jest.fn() },
    app: { upsert: jest.fn(), findMany: jest.fn() },
    schoolAppConfig: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { requireApp } from '../middleware/requireApp';
import { AuthRequest } from '../middleware/permissions.middleware';
import { requireSingleSchoolContext } from '../middleware/school.middleware';
import { APP_CATALOG, ensureSchoolModuleConfigs } from '../services/moduleCatalog.service';

const mockedPrisma = prisma as unknown as {
  school: { findFirst: jest.Mock; findMany: jest.Mock };
  app: { upsert: jest.Mock; findMany: jest.Mock };
  schoolAppConfig: {
    count: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
};

const makeRequest = (value: object = {}) => value as unknown as AuthRequest;

describe('module entitlement guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects module access if no school can be resolved', async () => {
    mockedPrisma.school.findFirst.mockResolvedValue(null);
    const next = jest.fn();

    await requireApp('accounting')(makeRequest({ user: { role: 'ADMIN' } }), {} as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'APP_CONFIG_MISSING' });
  });

  it('rejects module access when the school has no module configuration', async () => {
    mockedPrisma.schoolAppConfig.count.mockResolvedValue(0);
    const next = jest.fn();

    await requireApp('accounting')(
      makeRequest({ school: { id: 'school-1' }, user: { role: 'ADMIN' } }),
      {} as Response,
      next
    );

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'APP_CONFIG_MISSING' });
  });

  it('rejects a module whose row is missing from a partial configuration', async () => {
    mockedPrisma.schoolAppConfig.count.mockResolvedValue(1);
    mockedPrisma.schoolAppConfig.findFirst.mockResolvedValue(null);
    const next = jest.fn();

    await requireApp('accounting')(
      makeRequest({ school: { id: 'school-1' }, user: { role: 'ADMIN' } }),
      {} as Response,
      next
    );

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'APP_DISABLED' });
  });

  it('does not expose add-on modules when initializing a school with no config rows', async () => {
    mockedPrisma.schoolAppConfig.findMany.mockResolvedValue([]);
    mockedPrisma.app.findMany.mockResolvedValue(APP_CATALOG.map((app, index) => ({ ...app, id: `app-${index}` })));

    await ensureSchoolModuleConfigs('school-1');

    const rows = mockedPrisma.schoolAppConfig.upsert.mock.calls.map(([args]) => args.create);
    expect(rows.find((row) => row.slug === 'library' || row.appId === `app-${APP_CATALOG.findIndex((app) => app.slug === 'library')}`))
      .toMatchObject({ isActive: false });
    expect(rows.find((row) => row.appId === `app-${APP_CATALOG.findIndex((app) => app.slug === 'student-registry')}`))
      .toMatchObject({ isActive: true });
  });

  it('adds newly catalogued modules to partial configs as disabled', async () => {
    mockedPrisma.schoolAppConfig.findMany.mockResolvedValue([{ appId: 'existing-app' }]);
    mockedPrisma.app.findMany.mockResolvedValue([{ id: 'existing-app' }, { id: 'new-app' }]);

    await ensureSchoolModuleConfigs('school-1');

    expect(mockedPrisma.schoolAppConfig.upsert).toHaveBeenCalledWith({
      where: { schoolId_appId: { schoolId: 'school-1', appId: 'new-app' } },
      update: {},
      create: {
        schoolId: 'school-1',
        appId: 'new-app',
        isActive: false,
        isMandatory: false,
        isVisible: true,
      },
    });
  });

  it('allows finance requests only for exactly one active, non-archived school', async () => {
    mockedPrisma.school.findMany.mockResolvedValue([{ id: 'school-1', active: true, archived: false }]);
    const req = makeRequest({}) as Request & { schoolContext?: { schoolId: string } };
    const next: NextFunction = jest.fn();

    await requireSingleSchoolContext(req, {} as Response, next);

    expect(req.schoolContext).toEqual({ schoolId: 'school-1' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects finance requests when the single-school invariant is violated', async () => {
    mockedPrisma.school.findMany.mockResolvedValue([
      { id: 'school-1', active: true, archived: false },
      { id: 'school-2', active: true, archived: false },
    ]);
    const next = jest.fn();

    await requireSingleSchoolContext(makeRequest(), {} as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 503, code: 'SINGLE_SCHOOL_REQUIRED' });
  });
});
