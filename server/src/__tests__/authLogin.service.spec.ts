jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
    },
    communicationConfig: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../services/auth-token.service', () => ({
  authTokenService: {
    issueTokenPair: jest.fn(() => ({
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
    })),
  },
}));

import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { redisCacheService } from '../services/redis-cache.service';
import { authTokenService } from '../services/auth-token.service';
import { AuthLoginService } from '../services/auth-login.service';

const mockedBcrypt = bcrypt as unknown as { compare: jest.Mock };
const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  school: { findFirst: jest.Mock };
  communicationConfig: { findFirst: jest.Mock };
};
const mockedRedis = redisCacheService as unknown as {
  get: jest.Mock;
  set: jest.Mock;
  delete: jest.Mock;
};
const mockedAuthTokenService = authTokenService as unknown as {
  issueTokenPair: jest.Mock;
};

describe('AuthLoginService', () => {
  let service: AuthLoginService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthLoginService();
    mockedPrisma.school.findFirst.mockResolvedValue({
      id: 'school-1',
      institutionType: 'PRIMARY_CBC',
      institutionTypeLocked: true,
      requiresUserVerification: true,
    });
    mockedPrisma.communicationConfig.findFirst.mockResolvedValue(null);
  });

  it('preserves successful password login response shape and side effects', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.test',
      password: 'hashed',
      status: 'ACTIVE',
      loginAttempts: 2,
      lockedUntil: null,
      role: 'ADMIN',
      roles: ['ADMIN'],
      firstName: 'Ada',
      lastName: 'Admin',
      phone: '0712345678',
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: true,
      passwordResetToken: null,
    };
    mockedRedis.get.mockResolvedValue(null);
    mockedPrisma.user.findUnique.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await service.loginWithPassword({
      email: 'admin@example.test',
      password: 'secret123',
      requestSchool: null,
    });

    expect(mockedRedis.set).toHaveBeenCalledWith('auth:v2:user:admin@example.test', user, 5 * 60);
    expect(mockedAuthTokenService.issueTokenPair).toHaveBeenCalledWith(user);
    expect(mockedRedis.delete).toHaveBeenCalledWith('auth:v2:user:admin@example.test');
    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastLogin: expect.any(Date), loginAttempts: 0, lockedUntil: null },
    });
    expect(result).toMatchObject({
      success: true,
      token: 'access.jwt',
      refreshToken: 'refresh.jwt',
      requiresOtp: true,
      mustChangePassword: false,
      message: 'Login successful',
      user: {
        id: 'user-1',
        email: 'admin@example.test',
        role: 'ADMIN',
        roles: ['ADMIN'],
        schoolId: 'school-1',
        institutionTypeLocked: true,
        requiresInstitutionSetup: false,
        availableInstitutionTypes: ['PRIMARY_CBC', 'SECONDARY', 'TERTIARY'],
      },
    });
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('passwordResetToken');
  });

  it('allows password fallback login by phone number', async () => {
    const user = {
      id: 'teacher-1',
      email: 'teacher@example.test',
      password: 'hashed',
      status: 'ACTIVE',
      loginAttempts: 0,
      lockedUntil: null,
      role: 'TEACHER',
      roles: ['TEACHER'],
      firstName: 'Tina',
      lastName: 'Teacher',
      phone: '+254712345678',
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: true,
      passwordResetToken: null,
    };
    mockedRedis.get.mockResolvedValue(null);
    mockedPrisma.user.findMany.mockResolvedValue([user]);
    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await service.loginWithPassword({
      phone: '0712345678',
      password: 'secret123',
      requestSchool: null,
    });

    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        archived: false,
        OR: expect.arrayContaining([
          { phone: { in: expect.arrayContaining(['+254712345678']) } },
        ]),
      }),
    }));
    expect(result).toMatchObject({
      success: true,
      user: { id: 'teacher-1', role: 'TEACHER', roles: ['TEACHER'] },
      token: 'access.jwt',
      refreshToken: 'refresh.jwt',
    });
  });

  it('prefers a school admin over a student when a phone number is shared', async () => {
    const studentUser = {
      id: 'student-1',
      email: '1490@trendscore.co.ke',
      password: 'student-hashed',
      status: 'ACTIVE',
      loginAttempts: 0,
      lockedUntil: null,
      role: 'STUDENT',
      roles: [],
      firstName: 'Bridgit',
      lastName: 'Shania',
      phone: '0720705588',
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: false,
      passwordResetToken: null,
    };
    const adminUser = {
      ...studentUser,
      id: 'admin-1',
      email: 'guyo@example.test',
      password: 'admin-hashed',
      role: 'ADMIN',
      roles: ['ADMIN'],
      firstName: 'Guyo',
      lastName: 'Huqa',
      phone: '+254720705588',
      verificationRequired: true,
    };
    mockedRedis.get.mockResolvedValue(null);
    mockedPrisma.user.findMany.mockResolvedValue([studentUser, adminUser]);
    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await service.loginWithPassword({
      phone: '0720705588',
      password: 'secret123',
      requestSchool: null,
    });

    expect(mockedAuthTokenService.issueTokenPair).toHaveBeenCalledWith(adminUser);
    expect(result.user).toMatchObject({ id: 'admin-1', role: 'ADMIN', roles: ['ADMIN'] });
  });

  it('preserves invalid password behavior and increments login attempts', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.test',
      password: 'hashed',
      status: 'ACTIVE',
      loginAttempts: 2,
      lockedUntil: null,
      role: 'ADMIN',
      roles: ['ADMIN'],
      firstName: 'Ada',
      lastName: 'Admin',
      phone: null,
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: true,
      passwordResetToken: null,
    };
    mockedRedis.get.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(false);

    await expect(service.loginWithPassword({
      email: 'admin@example.test',
      password: 'wrong',
      requestSchool: null,
    })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });

    expect(mockedRedis.delete).toHaveBeenCalledWith('auth:v2:user:admin@example.test');
    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { loginAttempts: 3, lockedUntil: null },
    });
    expect(mockedAuthTokenService.issueTokenPair).not.toHaveBeenCalled();
  });

  it('locks password login after the maximum failed attempts', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.test',
      password: 'hashed',
      status: 'ACTIVE',
      loginAttempts: 4,
      lockedUntil: null,
      role: 'ADMIN',
      roles: ['ADMIN'],
      firstName: 'Ada',
      lastName: 'Admin',
      phone: null,
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: true,
      passwordResetToken: null,
    };
    mockedRedis.get.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(false);

    await expect(service.loginWithPassword({
      email: 'admin@example.test',
      password: 'wrong',
      requestSchool: null,
    })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { loginAttempts: 5, lockedUntil: expect.any(Date) },
    });
  });

  it('rejects password login while the account lock is active', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.test',
      password: 'hashed',
      status: 'ACTIVE',
      loginAttempts: 5,
      lockedUntil: new Date(Date.now() + 5 * 60 * 1000),
      role: 'ADMIN',
      roles: ['ADMIN'],
      firstName: 'Ada',
      lastName: 'Admin',
      phone: null,
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: true,
      passwordResetToken: null,
    };
    mockedRedis.get.mockResolvedValue(user);

    await expect(service.loginWithPassword({
      email: 'admin@example.test',
      password: 'secret123',
      requestSchool: null,
    })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Account is locked',
    });

    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    expect(mockedAuthTokenService.issueTokenPair).not.toHaveBeenCalled();
  });

  it('clears expired password locks before validating credentials', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.test',
      password: 'hashed',
      status: 'ACTIVE',
      loginAttempts: 5,
      lockedUntil: new Date(Date.now() - 5 * 60 * 1000),
      role: 'ADMIN',
      roles: ['ADMIN'],
      firstName: 'Ada',
      lastName: 'Admin',
      phone: null,
      lastLogin: null,
      institutionType: 'PRIMARY_CBC',
      emailVerified: true,
      verificationRequired: true,
      passwordResetToken: null,
    };
    mockedRedis.get.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true);

    await service.loginWithPassword({
      email: 'admin@example.test',
      password: 'secret123',
      requestSchool: null,
    });

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    expect(mockedAuthTokenService.issueTokenPair).toHaveBeenCalled();
  });
});
