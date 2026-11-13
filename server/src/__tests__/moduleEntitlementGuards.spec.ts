jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    school: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
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
import {
  APP_CATALOG,
  applyModulePackageToSchool,
  ensureSchoolModuleConfigs,
} from '../services/moduleCatalog.service';

const mockedPrisma = prisma as unknown as {
  school: { findFirst: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
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

  it.each([
    ['Public Primary', false],
    ['Private Primary', true],
    ['Private Secondary', false],
    [null, false],
    ['Unclassified', false],
  ])('applies Starter fees only for private primary schools (school type: %s)', async (schoolType, feeEnabled) => {
    mockedPrisma.school.findUnique.mockResolvedValue({ schoolType });
    mockedPrisma.app.findMany.mockResolvedValue(
      APP_CATALOG.map((app, index) => ({ id: `app-${index}`, slug: app.slug }))
    );

    await applyModulePackageToSchool('school-1', 'starter');

    const feeAppId = `app-${APP_CATALOG.findIndex((app) => app.slug === 'fee-management')}`;
    const feeConfig = mockedPrisma.schoolAppConfig.upsert.mock.calls
      .map(([args]) => args.create)
      .find((config) => config.appId === feeAppId);
    expect(feeConfig).toMatchObject({ isActive: feeEnabled });
  });

  it.each([
    ['standard', ['fee-management', 'transport']],
    ['professional', ['fee-management', 'accounting', 'library']],
    ['enterprise', ['fee-management', 'tertiary-modules']],
  ] as const)('preserves %s package entitlements', async (packageId, expectedSlugs) => {
    mockedPrisma.app.findMany.mockResolvedValue(
      APP_CATALOG.map((app, index) => ({ id: `app-${index}`, slug: app.slug }))
    );

    await applyModulePackageToSchool('school-1', packageId);

    const activeSlugs = new Set(mockedPrisma.schoolAppConfig.upsert.mock.calls
      .map(([args]) => args.create)
      .filter((config) => config.isActive)
      .map((config) => APP_CATALOG.find((app, index) => `app-${index}` === config.appId)?.slug));
    expectedSlugs.forEach((slug) => expect(activeSlugs.has(slug)).toBe(true));
  });

  it('allows the fee module for private-primary Starter schools', async () => {
    mockedPrisma.school.findUnique.mockResolvedValue({ schoolType: 'PRIVATE_PRIMARY' });
    mockedPrisma.schoolAppConfig.count.mockResolvedValue(1);
    mockedPrisma.schoolAppConfig.findFirst.mockResolvedValue({
      isActive: true,
      isVisible: true,
      app: { name: 'Fees & Billing' },
    });
    mockedPrisma.schoolAppConfig.findMany.mockResolvedValue([
      { app: { slug: 'student-registry' } },
      { app: { slug: 'attendance' } },
      { app: { slug: 'fee-management' } },
    ]);
    const next = jest.fn();

    await requireApp('fee-management')(
      makeRequest({ school: { id: 'school-1' }, user: { role: 'ADMIN' } }),
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it.each([['Public Primary'], [null], ['Unclassified']])(
    'rejects Starter fees when school type is not private primary (%s)',
    async (schoolType) => {
      mockedPrisma.school.findUnique.mockResolvedValue({ schoolType });
      mockedPrisma.schoolAppConfig.count.mockResolvedValue(1);
      mockedPrisma.schoolAppConfig.findFirst.mockResolvedValue({
        isActive: true,
        isVisible: true,
        app: { name: 'Fees & Billing' },
      });
      mockedPrisma.schoolAppConfig.findMany.mockResolvedValue([
        { app: { slug: 'student-registry' } },
        { app: { slug: 'attendance' } },
        { app: { slug: 'fee-management' } },
      ]);
      const next = jest.fn();

      await requireApp('fee-management')(
        makeRequest({ school: { id: 'school-1' }, user: { role: 'ADMIN' } }),
        {} as Response,
        next
      );

      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'APP_DISABLED' });
    }
  );

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

  it('does not assign Starter modules when a Secondary school has no package config', async () => {
    mockedPrisma.schoolAppConfig.findMany.mockResolvedValue([]);
    mockedPrisma.school.findUnique.mockResolvedValue({ institutionType: 'SECONDARY' });
    mockedPrisma.app.findMany.mockResolvedValue(APP_CATALOG.map((app, index) => ({ ...app, id: `app-${index}` })));

    await ensureSchoolModuleConfigs('school-1');

    const rows = mockedPrisma.schoolAppConfig.upsert.mock.calls.map(([args]) => args.create);
    expect(rows).toHaveLength(APP_CATALOG.length);
    expect(rows.every((row) => row.isActive === false)).toBe(true);
    expect(rows.some((row) => row.isActive && row.appId === `app-${APP_CATALOG.findIndex((app) => app.slug === 'student-registry')}`))
      .toBe(false);
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
