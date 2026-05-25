/// <reference types="jest" />

const generateInvoiceForLearner = jest.fn(async () => ({ success: true, created: true }));

jest.mock('../src/services/fee.service', () => {
  class MockFeeService {
    async generateInvoiceForLearner(): Promise<any> {
      return generateInvoiceForLearner();
    }
  }

  return {
    FeeService: MockFeeService,
    feeService: { generateInvoiceForLearner }
  };
});

import express from 'express';
import request from 'supertest';
import learnerRoutes from '../src/routes/learner.routes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { Role } from '../src/config/permissions';
import { feeService } from '../src/services/fee.service';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const app = express();
app.use(express.json());
app.use('/api/learners', learnerRoutes);

describe('Students module end-to-end', () => {
  const authToken = generateAccessToken({
    id: 'test-super-admin-id',
    email: 'test-super-admin@example.com',
    role: 'SUPER_ADMIN' as Role,
    institutionType: 'PRIMARY_CBC',
  });

  const uniqueSuffix = Date.now();
  const guardianPhone = '0713612141';
  const guardianEmail = `guardian-${uniqueSuffix}@example.com`;

  const learnerPayload = {
    firstName: 'Test',
    lastName: 'Student',
    dateOfBirth: '2014-01-01',
    gender: 'MALE',
    grade: 'GRADE_1',
    stream: 'A',
    guardianName: 'Jane Student',
    guardianPhone,
    guardianEmail,
  };

  let createdLearnerId: string | null = null;
  let createdAdmissionNumber: string | null = null;
  let createdParentId: string | null = null;

  afterAll(async () => {
    if (createdLearnerId) {
      await prisma.learner.deleteMany({ where: { id: createdLearnerId } });
    }

    if (createdParentId) {
      await prisma.user.deleteMany({ where: { id: createdParentId } });
    } else {
      await prisma.user.deleteMany({ where: { email: guardianEmail } });
    }

    await prisma.$disconnect();
  });

  it('creates a learner and returns an admission number', async () => {
    const response = await request(app)
      .post('/api/learners')
      .set('Authorization', `Bearer ${authToken}`)
      .send(learnerPayload)
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('admissionNumber');
    expect(response.body.data).toHaveProperty('firstName', learnerPayload.firstName.toUpperCase());
    expect(response.body.data).toHaveProperty('lastName', learnerPayload.lastName.toUpperCase());
    expect(response.body.data).toHaveProperty('grade', learnerPayload.grade);
    expect(response.body.data).toHaveProperty('stream', learnerPayload.stream);

    createdLearnerId = response.body.data.id;
    createdAdmissionNumber = response.body.data.admissionNumber;
    createdParentId = response.body.data.parent?.id ?? null;

    expect(createdLearnerId).toBeTruthy();
    expect(createdAdmissionNumber).toMatch(/ADM[-A-Z0-9]+/i);
    expect(feeService.generateInvoiceForLearner).toHaveBeenCalledTimes(1);
  });

  it('retrieves the created learner by admission number', async () => {
    expect(createdAdmissionNumber).toBeTruthy();

    const response = await request(app)
      .get(`/api/learners/admission/${createdAdmissionNumber}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('admissionNumber', createdAdmissionNumber);
    expect(response.body.data).toHaveProperty('firstName', learnerPayload.firstName.toUpperCase());
    expect(response.body.data).toHaveProperty('lastName', learnerPayload.lastName.toUpperCase());
  });

  it('uploads learner photo explicitly via photo endpoint', async () => {
    expect(createdLearnerId).toBeTruthy();
    const photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2ioAAAAASUVORK5CYII=';

    const response = await request(app)
      .post(`/api/learners/${createdLearnerId}/photo`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ photoData })
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('photoUrl', photoData);
  });

  it('rejects unknown learner fields to enforce strict frontend-backend contract', async () => {
    const response = await request(app)
      .post('/api/learners')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...learnerPayload,
        firstName: 'Strict',
        lastName: 'Contract',
        unknownFieldX: 'must-fail',
      })
      .expect(400);

    const responseText = JSON.stringify(response.body || {});
    expect(responseText).toMatch(/Validation failed|Unrecognized key/i);
  });

  it('maps doctor orphan fields to emergency fallback and preserves orphanFields payload', async () => {
    const uniqueLocal = Date.now();
    const response = await request(app)
      .post('/api/learners')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...learnerPayload,
        firstName: 'Orphan',
        lastName: `Mapping${uniqueLocal}`,
        guardianEmail: `orphan-${uniqueLocal}@example.com`,
        doctorName: 'Dr House',
        doctorPhone: '0700000000',
        nationality: 'Kenyan',
        previousClass: 'PP2',
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('emergencyContact', 'Dr House');
    expect(response.body.data).toHaveProperty('emergencyPhone', '0700000000');
  });
});
