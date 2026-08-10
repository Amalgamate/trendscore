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
process.env.BIOMETRIC_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const app = express();
app.use(express.json());
let biometricTestSchoolId: string | null = null;
app.use((req, _res, next) => {
  if (biometricTestSchoolId) {
    req.school = {
      id: biometricTestSchoolId,
      name: 'Biometric E2E Academy',
      institutionType: 'PRIMARY_CBC',
    };
  }
  next();
});
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
  let ownerSchoolId: string | null = null;

  beforeAll(async () => {
    const school = await prisma.school.upsert({
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
    biometricTestSchoolId = school.id;
    ownerSchoolId = school.id;

    await prisma.school.upsert({
      where: { name: 'Biometric E2E Other School' },
      update: { active: true, status: 'ACTIVE', archived: false },
      create: {
        name: 'Biometric E2E Other School',
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
    await prisma.school.deleteMany({ where: { name: 'Biometric E2E Other School' } }).catch(() => null);
    await prisma.$disconnect();
  });

  it('registers a biometric device and lists it', async () => {
    const createResponse = await request(app)
      .post('/api/biometric/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: biometricDeviceId,
        name: 'Test Biometric Terminal',
        type: 'PHONE',
        location: 'Main gate',
        ipAddress: '192.168.0.50'
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toHaveProperty('deviceId', biometricDeviceId);
    expect(createResponse.body.data).toHaveProperty('deviceToken', expect.any(String));
    expect(createResponse.body.data).not.toHaveProperty('token');
    expect(createResponse.body.data).not.toHaveProperty('tokenHash');

    deviceDbId = createResponse.body.data.id;
    deviceToken = createResponse.body.data.deviceToken;

    const listResponse = await request(app)
      .get('/api/biometric/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(listResponse.body.success).toBe(true);
    expect(Array.isArray(listResponse.body.data)).toBe(true);
    expect(listResponse.body.data.some((d: any) => d.deviceId === biometricDeviceId)).toBe(true);
    expect(listResponse.body.data[0]).not.toHaveProperty('token');
    expect(listResponse.body.data[0]).not.toHaveProperty('tokenHash');
  });

  it('does not expose or mutate a terminal from another school context', async () => {
    const otherSchool = await prisma.school.findUnique({ where: { name: 'Biometric E2E Other School' } });
    expect(otherSchool).toBeTruthy();
    expect(deviceDbId).toBeTruthy();

    biometricTestSchoolId = otherSchool!.id;
    try {
      const listResponse = await request(app)
        .get('/api/biometric/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(listResponse.body.data).toEqual([]);

      await request(app)
        .patch(`/api/biometric/devices/${deviceDbId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cross-school mutation' })
        .expect(404);

      await request(app)
        .post(`/api/biometric/devices/${deviceDbId}/rotate-token`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      await request(app)
        .post(`/api/biometric/devices/${deviceDbId}/activation`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    } finally {
      biometricTestSchoolId = ownerSchoolId;
    }
  });

  it('activates a phone terminal with a one-time setup code', async () => {
    const activationResponse = await request(app)
      .post(`/api/biometric/devices/${deviceDbId}/activation`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(activationResponse.body.data.activationCode).toMatch(/^\d{8}$/);
    expect(activationResponse.body.data.deviceId).toBe(biometricDeviceId);

    const terminalResponse = await request(app)
      .post('/api/biometric/terminal/activate')
      .send({
        deviceId: biometricDeviceId,
        activationCode: activationResponse.body.data.activationCode,
      })
      .expect(200);

    expect(terminalResponse.body.data.deviceToken).toEqual(expect.any(String));
    expect(terminalResponse.body.data.device).not.toHaveProperty('tokenHash');
    deviceToken = terminalResponse.body.data.deviceToken;

    await request(app)
      .post('/api/biometric/terminal/activate')
      .send({
        deviceId: biometricDeviceId,
        activationCode: activationResponse.body.data.activationCode,
      })
      .expect(401);
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

  it('requires recorded consent and terminal authentication before face liveness starts', async () => {
    await request(app)
      .post('/api/biometric/face/enrollment/session')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ personType: 'LEARNER', personId: learnerId, consentConfirmed: false })
      .expect(422);

    await request(app)
      .post('/api/biometric/terminal/face/session')
      .send({ deviceId: biometricDeviceId, direction: 'IN' })
      .expect(401);

    await request(app)
      .post('/api/biometric/terminal/events')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({
        eventId: `forged-face-${Date.now()}`,
        deviceId: biometricDeviceId,
        personId: learnerAdmissionNumber,
        personType: 'LEARNER',
        timestamp: new Date().toISOString(),
        direction: 'IN',
        modality: 'FACE',
      })
      .expect(403);
  });

  it('processes a biometric attendance log for the learner and returns logs', async () => {
    expect(deviceToken).toBeTruthy();
    const eventId = `test-event-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const logResponse = await request(app)
      .post('/api/biometric/terminal/events')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({
        eventId,
        deviceId: biometricDeviceId,
        personId: learnerAdmissionNumber,
        personType: 'LEARNER',
        timestamp,
        direction: 'IN',
        modality: 'MANUAL',
      })
      .expect(201);

    expect(logResponse.body.success).toBe(true);
    expect(logResponse.body.data).toHaveProperty('logId', expect.any(String));
    expect(logResponse.body.data).toHaveProperty('processingStatus', 'PROCESSED');
    expect(logResponse.body.data.outcome.person).toEqual(expect.objectContaining({
      reference: learnerAdmissionNumber,
      personType: 'LEARNER',
      grade: 'GRADE_1',
    }));
    expect(logResponse.body.data).not.toHaveProperty('personId');

    const duplicateResponse = await request(app)
      .post('/api/biometric/terminal/events')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({
        eventId,
        deviceId: biometricDeviceId,
        personId: learnerAdmissionNumber,
        personType: 'LEARNER',
        timestamp,
        direction: 'IN',
        modality: 'MANUAL',
        offlineCaptured: true,
      })
      .expect(200);
    expect(duplicateResponse.body.data.duplicate).toBe(true);

    await request(app)
      .post('/api/biometric/terminal/events')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({
        eventId,
        deviceId: biometricDeviceId,
        personId: `${learnerAdmissionNumber}-CHANGED`,
        personType: 'LEARNER',
        timestamp,
        direction: 'IN',
        modality: 'MANUAL',
      })
      .expect(409);

    const logsResponse = await request(app)
      .get('/api/biometric/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(logsResponse.body.success).toBe(true);
    expect(Array.isArray(logsResponse.body.data)).toBe(true);
    const matchingEvents = logsResponse.body.data.filter((log: any) => log.eventId === eventId);
    expect(matchingEvents).toHaveLength(1);
  });

  it('verifies the heartbeat, rotates the token once, and decommissions safely', async () => {
    expect(deviceDbId).toBeTruthy();
    expect(deviceToken).toBeTruthy();

    const testResponse = await request(app)
      .post(`/api/biometric/devices/${deviceDbId}/test`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(testResponse.body.data.status).toBe('CONNECTED');
    expect(testResponse.body.data.device.installationStatus).toBe('VERIFIED');

    const rotateResponse = await request(app)
      .post(`/api/biometric/devices/${deviceDbId}/rotate-token`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    const rotatedToken = rotateResponse.body.data.deviceToken;
    expect(rotatedToken).toEqual(expect.any(String));
    expect(rotatedToken).not.toBe(deviceToken);

    await request(app)
      .post('/api/biometric/log')
      .send({
        deviceId: biometricDeviceId,
        deviceToken,
        personId: learnerAdmissionNumber,
        personType: 'LEARNER',
        timestamp: new Date().toISOString(),
        direction: 'IN',
      })
      .expect(401);

    deviceToken = rotatedToken;
    await request(app)
      .post('/api/biometric/log')
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({
        deviceId: biometricDeviceId,
        personId: learnerAdmissionNumber,
        personType: 'LEARNER',
        timestamp: new Date().toISOString(),
        direction: 'IN',
      })
      .expect(200);

    const decommissionResponse = await request(app)
      .delete(`/api/biometric/devices/${deviceDbId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(decommissionResponse.body.data.status).toBe('DISABLED');

    await request(app)
      .post(`/api/biometric/devices/${deviceDbId}/rotate-token`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(409);
  });
});
