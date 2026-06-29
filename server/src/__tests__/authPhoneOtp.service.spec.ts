import crypto from 'crypto';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
    },
    communicationConfig: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    authOtpChallenge: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../services/sms.service', () => ({
  SmsService: {
    sendSms: jest.fn(),
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

import prisma from '../config/database';
import { SmsService } from '../services/sms.service';
import { authTokenService } from '../services/auth-token.service';
import { AuthPhoneOtpService, hashOtpCode } from '../services/auth-phone-otp.service';

const mockedPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  school: { findFirst: jest.Mock };
  communicationConfig: { findFirst: jest.Mock };
  auditLog: { create: jest.Mock };
  authOtpChallenge: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
};

const mockedSms = SmsService as unknown as { sendSms: jest.Mock };
const mockedAuthTokenService = authTokenService as unknown as { issueTokenPair: jest.Mock };

const validParent = {
  id: 'parent-1',
  email: 'parent@example.test',
  username: 'parent@example.test',
  password: 'hashed',
  status: 'ACTIVE',
  archived: false,
  loginAttempts: 0,
  lockedUntil: null,
  role: 'PARENT',
  roles: ['PARENT'],
  firstName: 'Pat',
  lastName: 'Parent',
  phone: '0712345678',
  lastLogin: null,
  institutionType: 'PRIMARY_CBC',
  emailVerified: true,
  verificationRequired: false,
  passwordResetToken: null,
};

const validSuperAdmin = {
  ...validParent,
  id: 'super-admin-1',
  email: 'admin@trendscore.app',
  username: 'admin@trendscore.app',
  role: 'SUPER_ADMIN',
  roles: ['SUPER_ADMIN'],
  firstName: 'System',
  lastName: 'Administrator',
  phone: '0713612141',
};

describe('AuthPhoneOtpService', () => {
  let service: AuthPhoneOtpService;
  const previousSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-for-otp-hashing';
    service = new AuthPhoneOtpService();
    mockedPrisma.school.findFirst.mockResolvedValue({
      id: 'school-1',
      active: true,
      institutionType: 'PRIMARY_CBC',
      institutionTypeLocked: true,
      requiresUserVerification: true,
    });
    mockedPrisma.communicationConfig.findFirst.mockResolvedValue({
      emailTemplates: { __security: { otpEnabled: false } },
    });
    mockedPrisma.user.update.mockResolvedValue({});
    mockedPrisma.auditLog.create.mockResolvedValue({});
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousSecret;
  });

  it('creates a hashed phone OTP challenge without storing plaintext OTP', async () => {
    jest.spyOn(crypto, 'randomInt').mockImplementationOnce((() => 123456) as any);
    mockedPrisma.user.findFirst.mockResolvedValue({ id: 'parent-1' });
    mockedPrisma.authOtpChallenge.findFirst.mockResolvedValue(null);
    mockedPrisma.authOtpChallenge.create.mockResolvedValue({
      id: 'challenge-1',
      expiresAt: new Date('2026-06-28T12:10:00.000Z'),
    });
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});

    const result = await service.requestParentOtp({
      phone: '0712345678',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        archived: false,
      }),
      select: { id: true },
    }));
    expect(mockedPrisma.authOtpChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'parent-1',
        phoneRaw: '0712345678',
        phoneNormalized: '+254712345678',
        purpose: 'PARENT_PHONE_LOGIN',
        status: 'PENDING',
        codeHash: 'pending',
        maxAttempts: 5,
        maxResends: 3,
      }),
    }));
    const updateCall = mockedPrisma.authOtpChallenge.update.mock.calls[0][0];
    expect(updateCall.data.codeHash).toBe(hashOtpCode('123456', 'challenge-1'));
    expect(updateCall.data.codeHash).not.toBe('123456');
    expect(mockedSms.sendSms).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      challengeId: 'challenge-1',
      phone: '+254712345678',
      resendAfterSeconds: 60,
    });
  });

  it('uses the fixed setup OTP only for the configured super admin phone', async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({ id: 'super-admin-1' });
    mockedPrisma.authOtpChallenge.findFirst.mockResolvedValue(null);
    mockedPrisma.authOtpChallenge.create.mockResolvedValue({
      id: 'challenge-setup',
      expiresAt: new Date('2026-06-28T12:10:00.000Z'),
    });
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});

    await service.requestParentOtp({
      phone: '0713612141',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        archived: false,
      }),
    }));
    const updateCall = mockedPrisma.authOtpChallenge.update.mock.calls[0][0];
    expect(updateCall.data.codeHash).toBe(hashOtpCode('123456', 'challenge-setup'));
    expect(mockedSms.sendSms).not.toHaveBeenCalled();
  });

  it('enforces resend cooldown for pending challenges', async () => {
    mockedPrisma.authOtpChallenge.findFirst.mockResolvedValue({
      id: 'challenge-1',
      lastSentAt: new Date(),
      resendCount: 0,
      maxResends: 3,
      lockedUntil: null,
    });

    await expect(service.requestParentOtp({ phone: '0712345678' })).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('verifies a valid phone OTP challenge and issues the shared authenticated session', async () => {
    const challenge = {
      id: 'challenge-1',
      userId: 'parent-1',
      phoneNormalized: '+254712345678',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-1'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    };
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue(challenge);
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});
    mockedPrisma.user.findUnique.mockResolvedValue(validParent);

    const result = await service.verifyParentOtp({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    });

    expect(mockedPrisma.authOtpChallenge.update).toHaveBeenCalledWith({
      where: { id: 'challenge-1' },
      data: expect.objectContaining({
        status: 'VERIFIED',
        verifiedAt: expect.any(Date),
        attempts: 1,
      }),
    });
    expect(result).toMatchObject({
      success: true,
      token: 'access.jwt',
      refreshToken: 'refresh.jwt',
      requiresOtp: false,
      mustChangePassword: false,
      message: 'Login successful',
    });
    expect(mockedAuthTokenService.issueTokenPair).toHaveBeenCalledWith(validParent);
    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'parent-1' },
      data: { lastLogin: expect.any(Date), loginAttempts: 0, lockedUntil: null },
    });
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'PARENT_LOGIN_VIA_OTP',
        userId: 'parent-1',
        userRole: 'PARENT',
        method: 'PHONE_OTP',
        path: '/api/auth/phone-otp/verify',
      }),
    });
    expect(mockedPrisma.authOtpChallenge.update).toHaveBeenLastCalledWith({
      where: { id: 'challenge-1' },
      data: expect.objectContaining({
        status: 'CONSUMED',
        consumedAt: expect.any(Date),
      }),
    });
  });

  it('locks a challenge after too many invalid attempts', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: 'parent-1',
      phoneNormalized: '+254712345678',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-1'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 4,
      maxAttempts: 5,
    });
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});

    await expect(service.verifyParentOtp({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '000000',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid OTP code',
    });

    expect(mockedPrisma.authOtpChallenge.update).toHaveBeenCalledWith({
      where: { id: 'challenge-1' },
      data: expect.objectContaining({
        attempts: 5,
        status: 'LOCKED',
        lockedUntil: expect.any(Date),
      }),
    });
  });

  it('rejects a valid OTP for a disabled parent before issuing tokens', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: 'parent-1',
      phoneNormalized: '+254712345678',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-1'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ ...validParent, status: 'DISABLED' });

    await expect(service.verifyParentOtp({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Unable to authenticate this account',
    });

    expect(mockedAuthTokenService.issueTokenPair).not.toHaveBeenCalled();
  });

  it('allows a valid OTP for a non-parent role through the unified phone login flow', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: 'teacher-1',
      phoneNormalized: '+254712345678',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-1'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ ...validParent, id: 'teacher-1', role: 'TEACHER', roles: ['TEACHER'] });

    const result = await service.verifyParentOtp({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    });

    expect(result).toMatchObject({
      success: true,
      token: 'access.jwt',
      refreshToken: 'refresh.jwt',
      user: { id: 'teacher-1', role: 'TEACHER', roles: ['TEACHER'] },
    });
    expect(mockedAuthTokenService.issueTokenPair).toHaveBeenCalledWith(expect.objectContaining({
      id: 'teacher-1',
      role: 'TEACHER',
      roles: ['TEACHER'],
    }));
  });

  it('verifies the fixed setup OTP for the configured super admin phone', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-setup',
      userId: 'super-admin-1',
      phoneNormalized: '+254713612141',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-setup'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    });
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});
    mockedPrisma.user.findUnique.mockResolvedValue(validSuperAdmin);

    const result = await service.verifyParentOtp({
      challengeId: 'challenge-setup',
      phone: '0713612141',
      code: '123456',
    });

    expect(result).toMatchObject({
      success: true,
      token: 'access.jwt',
      refreshToken: 'refresh.jwt',
      user: { id: 'super-admin-1', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
    });
    expect(mockedAuthTokenService.issueTokenPair).toHaveBeenCalledWith(validSuperAdmin);
  });

  it('rejects the setup phone if it resolves to a non-super-admin account', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-setup',
      userId: 'teacher-1',
      phoneNormalized: '+254713612141',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-setup'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    });
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});
    mockedPrisma.user.findUnique.mockResolvedValue({
      ...validParent,
      id: 'teacher-1',
      role: 'TEACHER',
      roles: ['TEACHER'],
    });

    await expect(service.verifyParentOtp({
      challengeId: 'challenge-setup',
      phone: '0713612141',
      code: '123456',
    })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Unable to authenticate this account',
    });
  });

  it('rejects a valid OTP for a locked parent before issuing tokens', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: 'parent-1',
      phoneNormalized: '+254712345678',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-1'),
      expiresAt: new Date(Date.now() + 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ ...validParent, lockedUntil: new Date(Date.now() + 60_000) });

    await expect(service.verifyParentOtp({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Account is locked',
    });

    expect(mockedAuthTokenService.issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects an expired OTP before parent lookup', async () => {
    mockedPrisma.authOtpChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      userId: 'parent-1',
      phoneNormalized: '+254712345678',
      purpose: 'PARENT_PHONE_LOGIN',
      status: 'PENDING',
      codeHash: hashOtpCode('123456', 'challenge-1'),
      expiresAt: new Date(Date.now() - 60_000),
      lockedUntil: null,
      attempts: 0,
      maxAttempts: 5,
    });
    mockedPrisma.authOtpChallenge.update.mockResolvedValue({});

    await expect(service.verifyParentOtp({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'OTP has expired',
    });

    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedAuthTokenService.issueTokenPair).not.toHaveBeenCalled();
  });
});
