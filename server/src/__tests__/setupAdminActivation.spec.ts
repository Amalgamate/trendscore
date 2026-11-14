jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../services/auth-cache.service', () => ({
  invalidateAuthLookupCache: jest.fn(),
}));

jest.mock('../services/moduleCatalog.service', () => ({
  applyModulePackageToSchool: jest.fn(),
  enableOptionalSchoolModules: jest.fn(),
  initializeUnassignedSchoolModules: jest.fn(),
}));

import prisma from '../config/database';
import { invalidateAuthLookupCache } from '../services/auth-cache.service';
import { ensureSuperAdmin } from '../utils/setup-admin';

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  school: { findFirst: jest.Mock; upsert: jest.Mock };
  $transaction: jest.Mock;
};

const applicationEnvironment = [
  'APPLICATION_ID',
  'SUPER_ADMIN_ACTIVATION_TOKEN',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_FIRST_NAME',
  'SUPER_ADMIN_LAST_NAME',
  'SUPER_ADMIN_PHONE',
  'SCHOOL_INSTITUTION_TYPE',
  'SCHOOL_TYPE',
  'SCHOOL_ACCOMMODATION_TYPE',
  'APPLICATION_PACKAGE_ID',
  'APPLICATION_MODULE_SLUGS',
  'SCHOOL_TRANSPORT_NEEDED',
  'CREATE_EXTRA_DEMO_USERS',
];

const originalEnvironment = Object.fromEntries(
  applicationEnvironment.map(key => [key, process.env[key]]),
);

describe('school application administrator activation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, {
      APPLICATION_ID: 'application-1',
      SUPER_ADMIN_ACTIVATION_TOKEN: 'single-use-token',
      SUPER_ADMIN_EMAIL: 'admin@example.test',
      SUPER_ADMIN_FIRST_NAME: 'Amina',
      SUPER_ADMIN_LAST_NAME: 'Example',
      SUPER_ADMIN_PHONE: '0712345678',
      SCHOOL_INSTITUTION_TYPE: 'PRIMARY_CBC',
      SCHOOL_TYPE: 'PUBLIC_PRIMARY',
      SCHOOL_ACCOMMODATION_TYPE: 'DAY',
      APPLICATION_PACKAGE_ID: 'starter',
      APPLICATION_MODULE_SLUGS: '[]',
      SCHOOL_TRANSPORT_NEEDED: 'false',
      CREATE_EXTRA_DEMO_USERS: 'false',
    });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    mockedPrisma.user.update.mockResolvedValue({});
    mockedPrisma.school.findFirst.mockResolvedValue({
      id: 'school-1',
      name: 'Example School',
      provisioningApplicationId: null,
    });
    mockedPrisma.$transaction.mockImplementation(async callback => callback({
      school: { update: jest.fn().mockResolvedValue({}) },
    }));
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('sets an expiring activation token on an existing admin during initial application provisioning', async () => {
    await ensureSuperAdmin();

    const userUpdate = mockedPrisma.user.update.mock.calls[0][0];
    expect(userUpdate.data).toMatchObject({
      emailVerified: false,
      passwordResetToken: 'single-use-token',
      authVersion: { increment: 1 },
    });
    expect(userUpdate.data.passwordResetExpiry.getTime()).toBeGreaterThan(Date.now());
    expect(userUpdate.data.passwordResetExpiry.getTime()).toBeLessThanOrEqual(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    expect(invalidateAuthLookupCache).toHaveBeenCalledTimes(1);
  });

  it('does not reissue activation after the application is linked to its school', async () => {
    mockedPrisma.school.findFirst.mockResolvedValue({
      id: 'school-1',
      name: 'Example School',
      provisioningApplicationId: 'application-1',
    });

    await ensureSuperAdmin();

    const userUpdate = mockedPrisma.user.update.mock.calls[0][0];
    expect(userUpdate.data).not.toHaveProperty('passwordResetToken');
    expect(userUpdate.data).not.toHaveProperty('passwordResetExpiry');
    expect(userUpdate.data).not.toHaveProperty('authVersion');
    expect(invalidateAuthLookupCache).not.toHaveBeenCalled();
  });
});
