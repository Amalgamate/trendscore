/// <reference types="jest" />

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../src/services/redis-cache.service', () => {
  const store = new Map<string, { value: any; expiresAt: number | null }>();
  const now = () => Date.now();

  return {
    redisCacheService: {
      get: jest.fn(async (key: string) => {
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expiresAt && entry.expiresAt <= now()) {
          store.delete(key);
          return null;
        }
        return entry.value;
      }),
      set: jest.fn(async (key: string, value: any, ttlSeconds?: number) => {
        store.set(key, {
          value,
          expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : null,
        });
      }),
      delete: jest.fn(async (key: string) => {
        store.delete(key);
        return true;
      }),
      deleteByPrefix: jest.fn(async (prefix: string) => {
        let deleted = 0;
        for (const key of Array.from(store.keys())) {
          if (key.startsWith(prefix)) {
            store.delete(key);
            deleted += 1;
          }
        }
        return deleted;
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
      getInfo: jest.fn(() => ({ backend: 'Memory', memorySize: store.size })),
      destroy: jest.fn(() => undefined),
    },
  };
});

jest.mock('../src/services/sms.service', () => ({
  SmsService: {
    sendSms: jest.fn(async () => ({ success: true })),
    sendFeeInvoiceNotification: jest.fn(async () => ({ success: true })),
    sendAssessmentReport: jest.fn(async () => ({ success: true })),
  },
}));

jest.mock('../src/services/whatsapp.service', () => ({
  whatsappService: {
    sendMessage: jest.fn(async () => ({ success: true })),
  },
}));

jest.mock('../src/services/email-resend.service', () => ({
  EmailService: {
    sendWelcomeEmail: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
    sendNotificationEmail: jest.fn(async () => undefined),
    sendFeeInvoiceEmail: jest.fn(async () => undefined),
    sendOnboardingEmail: jest.fn(async () => undefined),
  },
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || 'test-otp-hash-secret';

describe('Student phone login integration', () => {
  jest.setTimeout(30000);

  const parentId = 'student-phone-parent-id';
  const studentId = 'student-phone-student-id';
  const learnerId = 'student-phone-learner-id';
  const parentPhone = '+254711000123';
  const parentPassword = 'ParentPass123!';
  const studentPassword = 'StudentPass123!';
  const admissionNumber = 'STU-PHONE-001';

  let prisma: any;
  let authRoutes: any;

  beforeAll(async () => {
    prisma = (await import('../src/config/database')).default;
    authRoutes = (await import('../src/routes/auth.routes')).default;

    await prisma.school.upsert({
      where: { name: 'Student Phone Login Smoke Academy' },
      update: {
        active: true,
        status: 'ACTIVE',
        archived: false,
        institutionType: 'PRIMARY_CBC',
        institutionTypeLocked: true,
        requiresUserVerification: false,
      },
      create: {
        name: 'Student Phone Login Smoke Academy',
        active: true,
        status: 'ACTIVE',
        institutionType: 'PRIMARY_CBC',
        institutionTypeLocked: true,
        requiresUserVerification: false,
        curriculumType: 'CBC_AND_EXAM',
      },
    });

    await prisma.learner.deleteMany({ where: { id: learnerId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [parentId, studentId] } } }).catch(() => undefined);

    await prisma.user.create({
      data: {
        id: parentId,
        email: 'student-phone-parent@example.test',
        username: 'student-phone-parent',
        password: await bcrypt.hash(parentPassword, 4),
        firstName: 'Pat',
        lastName: 'Parent',
        phone: parentPhone,
        role: 'PARENT',
        roles: ['PARENT'],
        status: 'ACTIVE',
        archived: false,
        emailVerified: true,
        verificationRequired: false,
        institutionType: 'PRIMARY_CBC',
      },
    });

    await prisma.user.create({
      data: {
        id: studentId,
        email: 'STU-PHONE-001@trendscore.co.ke',
        username: 'STU-PHONE-001',
        password: await bcrypt.hash(studentPassword, 4),
        firstName: 'Sam',
        lastName: 'Student',
        role: 'STUDENT',
        roles: ['STUDENT'],
        status: 'ACTIVE',
        archived: false,
        emailVerified: true,
        verificationRequired: false,
        institutionType: 'PRIMARY_CBC',
      },
    });

    await prisma.learner.create({
      data: {
        id: learnerId,
        admissionNumber,
        firstName: 'Sam',
        lastName: 'Student',
        dateOfBirth: new Date('2014-01-15T00:00:00.000Z'),
        gender: 'MALE',
        grade: 'GRADE_4',
        parentId,
        guardianPhone: parentPhone,
        status: 'ACTIVE',
        archived: false,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.auditLog.deleteMany({ where: { userId: { in: [parentId, studentId] } } }).catch(() => undefined);
    await prisma.learner.deleteMany({ where: { id: learnerId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [parentId, studentId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('looks up one student, logs in with that student, and leaves parent phone login unaffected', async () => {
    const lookupResp = await request(createApp(authRoutes))
      .post('/api/auth/student-phone/lookup')
      .send({ phone: '0711000123' })
      .expect(200);

    expect(lookupResp.body?.candidates).toHaveLength(1);
    expect(lookupResp.body?.candidates?.[0]).toMatchObject({
      studentUserId: studentId,
      admissionNumber,
      firstName: 'SAM',
      lastName: 'STUDENT',
      grade: 'GRADE_4',
    });
    expect(typeof lookupResp.body?.sessionToken).toBe('string');

    const studentLoginResp = await request(createApp(authRoutes))
      .post('/api/auth/student-phone/login')
      .send({
        sessionToken: lookupResp.body.sessionToken,
        studentUserId: studentId,
        password: studentPassword,
      })
      .expect(200);

    expect(studentLoginResp.body?.success).toBe(true);
    expect(studentLoginResp.body?.user?.role).toBe('STUDENT');
    expect(studentLoginResp.body?.user?.id).toBe(studentId);

    const decoded = jwt.verify(studentLoginResp.body.token, process.env.JWT_SECRET!) as any;
    expect(decoded.userId).toBe(studentId);
    expect(decoded.role).toBe('STUDENT');

    const parentLoginResp = await request(createApp(authRoutes))
      .post('/api/auth/login')
      .send({ phone: '0711000123', password: parentPassword })
      .expect(200);

    expect(parentLoginResp.body?.success).toBe(true);
    expect(parentLoginResp.body?.user?.id).toBe(parentId);
    expect(parentLoginResp.body?.user?.role).toBe('PARENT');
  });
});

function createApp(authRoutes: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}
