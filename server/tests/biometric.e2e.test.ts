/// <reference types="jest" />

import express from 'express';
import request from 'supertest';
import biometricRoutes from '../src/routes/biometric.routes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { Role } from '../src/config/permissions';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.NODE_ENV = 'test';
process.env.BIOMETRIC_ENCRYPTION_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const app = express();
app.use(express.json());
app.use('/api/biometric', biometricRoutes);

describe('Biometric module end-to-end', () => {
  const authToken = generateAccessToken({
    id: 'test-biometric-admin-id',
    email: 'test-biometric-admin@example.com',
    role: 'SUPER_ADMIN' as Role,
    institutionType: 'PRIMARY_CBC',
  });

  const learnerAdmissionNumber = `TEST-BIO-${Date.now()}`;
  const biometricDeviceId = 'TEST_DEVICE_001';

  let learnerId: string | null = null;
  let deviceDbId: string | null = null;
  let deviceToken: string | null = null;
  let credentialId: string | null = null;

  beforeAll(async () => {
    await prisma.school.upsert({
      where: { name: 'Biometric E2E Academy' },
      update: {
        active: true,
        status: 'ACTIVE',
        archived: false,
        institutionType: 'PRIMARY_CBC',
        institutionTypeLocked: true,
        requiresUserVerification: false,
      },
      create: {
        name: 'Biometric E2E Academy',
        active: true,
        status: 'ACTIVE',
        institutionType: 'PRIMARY_CBC',
        institutionTypeLocked: true,
        requiresUserVerification: false,
        curriculumType: 'CBC_AND_EXAM',
      },
    });

    await prisma.user.upsert({
      where: { id: 'test-biometric-admin-id' },
      update: {
        email: 'test-biometric-admin@example.com',
        username: 'test-biometric-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Biometric',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      },
      create: {
        id: 'test-biometric-admin-id',
        email: 'test-biometric-admin@example.com',
        username: 'test-biometric-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Biometric',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });

    const learner = await prisma.learner.create({
      data: {
        admissionNumber: learnerAdmissionNumber,
        firstName: 'Bio',
        lastName: 'Learner',
        dateOfBirth: new Date('2015-05-10'),
        gender: 'MALE',
        grade: 'GRADE_1',
        status: 'ACTIVE'
      }
    });

    learnerId = learner.id;
  });

  afterAll(async () => {
    if (credentialId) {
      await prisma.biometricCredential.deleteMany({ where: { id: credentialId } }).catch(() => null);
    }
    if (deviceDbId) {
      await prisma.biometricLog.deleteMany({ where: { deviceId: deviceDbId } }).catch(() => null);
      await prisma.biometricDevice.deleteMany({ where: { id: deviceDbId } }).catch(() => null);
    }
    if (learnerId) {
      await prisma.attendance.deleteMany({ where: { learnerId } }).catch(() => null);
      await prisma.learner.deleteMany({ where: { id: learnerId } }).catch(() => null);
    }
    await prisma.user.deleteMany({ where: { id: 'test-biometric-admin-id' } }).catch(() => null);
    await prisma.school.deleteMany({ where: { name: 'Biometric E2E Academy' } }).catch(() => null);
    await prisma.$disconnect();
  });

  it('registers a biometric device and lists it', async () => {
    const createResponse = await request(app)
      .post('/api/biometric/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: biometricDeviceId,
        name: 'Test Biometric Terminal',
        type: 'TERMINAL',
        location: 'Main gate',
        ipAddress: '192.168.0.50'
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toHaveProperty('deviceId', biometricDeviceId);
    expect(createResponse.body.data).toHaveProperty('token');

    deviceDbId = createResponse.body.data.id;
    deviceToken = createResponse.body.data.token;

    const listResponse = await request(app)
      .get('/api/biometric/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(listResponse.body.success).toBe(true);
    expect(Array.isArray(listResponse.body.data)).toBe(true);
    expect(listResponse.body.data.some((d: any) => d.deviceId === biometricDeviceId)).toBe(true);
  });

  it('enrolls a biometric credential for a learner', async () => {
    const enrollResponse = await request(app)
      .post('/api/biometric/enroll')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        learnerId,
        type: 'FINGERPRINT',
        template: 'TEST_TEMPLATE_DATA',
        fingerIndex: 1,
        quality: 90
      })
      .expect(201);

    expect(enrollResponse.body.success).toBe(true);
    expect(enrollResponse.body.data).toHaveProperty('learnerId', learnerId);
    credentialId = enrollResponse.body.data.id;
  });

  it('processes a biometric attendance log for the learner and returns logs', async () => {
    expect(deviceToken).toBeTruthy();

    const logResponse = await request(app)
      .post('/api/biometric/log')
      .send({
        deviceId: biometricDeviceId,
        deviceToken,
        personId: learnerAdmissionNumber,
        personType: 'LEARNER',
        timestamp: new Date().toISOString(),
        direction: 'IN'
      })
      .expect(200);

    expect(logResponse.body.success).toBe(true);
    expect(logResponse.body.data).toHaveProperty('personId', learnerAdmissionNumber);
    expect(logResponse.body.data).toHaveProperty('status', 'PENDING');

    const logsResponse = await request(app)
      .get('/api/biometric/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(logsResponse.body.success).toBe(true);
    expect(Array.isArray(logsResponse.body.data)).toBe(true);
    expect(logsResponse.body.data.some((log: any) => log.personId === learnerAdmissionNumber)).toBe(true);
  });
});
