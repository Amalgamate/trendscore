/// <reference types="jest" />

jest.mock('../src/services/whatsapp.service', () => ({
  whatsappService: {
    sendFeeReminder: jest.fn(async () => ({ success: true })),
    sendMessage: jest.fn(async () => ({ success: true })),
    sendAssessmentNotification: jest.fn(async () => ({ success: true })),
    sendAnnouncement: jest.fn(async () => ({ success: true })),
    sendCustomMessage: jest.fn(async () => ({ success: true })),
  }
}));

jest.mock('../src/services/sms.service', () => ({
  SmsService: {
    sendSms: jest.fn(async () => ({ success: true })),
    sendFeeInvoiceNotification: jest.fn(async () => ({ success: true })),
    sendAssessmentReport: jest.fn(async () => ({ success: true })),
  }
}));

jest.mock('../src/services/email.service', () => ({
  EmailService: {
    sendNotificationEmail: jest.fn(async () => undefined),
    sendFeeInvoiceEmail: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined)
  }
}));

jest.mock('../src/services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    deleteByPrefix: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
    getInfo: jest.fn(() => ({ backend: 'Memory', memorySize: 0 })),
    destroy: jest.fn(() => undefined)
  }
}));

import express from 'express';
import request from 'supertest';
import learnerRoutes from '../src/routes/learner.routes';
import assessmentRoutes from '../src/routes/assessmentRoutes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { Role } from '../src/config/permissions';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.NODE_ENV = 'test';

const app = express();
app.use(express.json());
app.use('/api/learners', learnerRoutes);
app.use('/api/assessments', assessmentRoutes);

describe('Assessment module end-to-end', () => {
  const authToken = generateAccessToken({
    id: 'test-assessment-admin-id',
    email: 'test-assessment-admin@example.com',
    role: 'SUPER_ADMIN' as Role,
    institutionType: 'PRIMARY_CBC',
  });

  const guardianPhone = '0713612142';
  const guardianEmail = 'assessment-parent@example.com';

  let learnerId: string | null = null;
  let parentId: string | null = null;
  let formativeId: string | null = null;
  let summativeTestId: string | null = null;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: 'test-assessment-admin-id' },
      update: {
        email: 'test-assessment-admin@example.com',
        username: 'test-assessment-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Assessment',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      },
      create: {
        id: 'test-assessment-admin-id',
        email: 'test-assessment-admin@example.com',
        username: 'test-assessment-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Assessment',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    if (formativeId) {
      await prisma.formativeAssessment.deleteMany({ where: { id: formativeId } });
    }
    if (summativeTestId) {
      await prisma.summativeResultHistory.deleteMany({
        where: {
          result: {
            testId: summativeTestId
          }
        }
      });
      await prisma.summativeResult.deleteMany({ where: { testId: summativeTestId } });
      await prisma.summativeTest.deleteMany({ where: { id: summativeTestId } });
    }
    if (learnerId) {
      const invoice = await prisma.feeInvoice.findFirst({ where: { learnerId } });
      if (invoice) {
        await prisma.feePayment.deleteMany({ where: { invoiceId: invoice.id } });
        await prisma.feeInvoice.deleteMany({ where: { learnerId } });
      }
      await prisma.learner.deleteMany({ where: { id: learnerId } });
    }
    if (parentId) {
      await prisma.user.deleteMany({ where: { id: parentId } });
    } else {
      await prisma.user.deleteMany({ where: { email: guardianEmail } });
    }
    await prisma.$disconnect();
  });

  it('creates a learner, records a formative assessment, and fetches learner formative results', async () => {
    const learnerResponse = await request(app)
      .post('/api/learners')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Assessment',
        lastName: 'Learner',
        dateOfBirth: '2014-05-15',
        gender: 'FEMALE',
        grade: 'GRADE_1',
        stream: 'A',
        guardianName: 'Assessment Parent',
        guardianPhone,
        guardianEmail
      })
      .expect(201);

    expect(learnerResponse.body.success).toBe(true);
    learnerId = learnerResponse.body.data.id;
    parentId = learnerResponse.body.data.parent?.id || null;
    expect(learnerId).toBeTruthy();

    const formativeResponse = await request(app)
      .post('/api/assessments/formative')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        learnerId,
        learningArea: 'English',
        strand: 'Reading',
        subStrand: 'Comprehension',
        term: 'TERM_1',
        academicYear: new Date().getFullYear(),
        overallRating: 'EE',
        detailedRating: 'EE1',
        teacherComment: 'Excellent progress',
        nextSteps: 'Continue reading comprehension practice',
        weight: 10,
        title: 'Term 1 English Assessment',
        type: 'EXAM'
      })
      .expect(201);

    expect(formativeResponse.body.success).toBe(true);
    expect(formativeResponse.body.data).toHaveProperty('id');
    formativeId = formativeResponse.body.data.id;

    const learnerFormatives = await request(app)
      .get(`/api/assessments/formative/learner/${learnerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(learnerFormatives.body.success).toBe(true);
    expect(Array.isArray(learnerFormatives.body.data)).toBe(true);
    expect(learnerFormatives.body.data.length).toBeGreaterThanOrEqual(1);
    expect(learnerFormatives.body.data[0]).toHaveProperty('learningArea', 'English');
  });

  it('creates a summative test, records a result, and retrieves test and learner summaries', async () => {
    const uniqueSuffix = Date.now();
    const academicYear = new Date().getFullYear();

    const createTest = await request(app)
      .post('/api/assessments/tests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Maths Term Test ${uniqueSuffix}`,
        learningArea: `Mathematics ${uniqueSuffix}`,
        term: 'TERM_1',
        academicYear,
        testDate: new Date().toISOString(),
        totalMarks: 100,
        passMarks: 40,
        grade: 'GRADE_1',
        stream: 'A',
        curriculum: 'CBC_AND_EXAM',
        description: 'Term 1 Mathematics assessment',
        instructions: 'Answer all questions',
        weight: 1
      })
      .expect(201);

    expect(createTest.body.success).toBe(true);
    summativeTestId = createTest.body.data.id;
    expect(summativeTestId).toBeTruthy();

    const recordResult = await request(app)
      .post('/api/assessments/summative/results')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        testId: summativeTestId,
        learnerId,
        marksObtained: 95,
        remarks: 'Very good',
        teacherComment: 'Strong performance'
      })
      .expect(201);

    expect(recordResult.body.success).toBe(true);
    expect(recordResult.body.data).toHaveProperty('grade');
    expect(recordResult.body.data).toHaveProperty('status', 'PASS');

    const learnerResults = await request(app)
      .get(`/api/assessments/summative/results/learner/${learnerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(learnerResults.body.success).toBe(true);
    expect(Array.isArray(learnerResults.body.data)).toBe(true);
    expect(learnerResults.body.data.length).toBeGreaterThanOrEqual(1);
    expect(learnerResults.body.data[0]).toHaveProperty('status', 'PASS');
    expect(learnerResults.body.data[0]).toHaveProperty('test');
    expect(learnerResults.body.data[0].test.learningArea).toMatch(/^Mathematics/);

    const testResults = await request(app)
      .get(`/api/assessments/summative/results/test/${summativeTestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(testResults.body.success).toBe(true);
    expect(Array.isArray(testResults.body.data)).toBe(true);
    expect(testResults.body.data.length).toBeGreaterThanOrEqual(1);
    expect(testResults.body.data[0]).toHaveProperty('learner');
  });
});
