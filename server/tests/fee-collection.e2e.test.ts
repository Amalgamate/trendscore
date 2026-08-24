/// <reference types="jest" />

jest.mock('../src/services/whatsapp.service', () => ({
  whatsappService: {
    sendFeeReminder: jest.fn(async () => ({ success: true })),
    sendMessage: jest.fn(async () => ({ success: true })),
    sendFeePaymentNotification: jest.fn(async () => ({ success: true })),
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

jest.mock('../src/services/accounting.service', () => ({
  accountingService: {
    postFeeInvoiceToLedger: jest.fn(async () => undefined),
    postFeePaymentToLedger: jest.fn(async () => undefined)
  }
}));

jest.mock('../src/services/compliance.service', () => ({
  complianceService: {
    syncInvoiceToETIMS: jest.fn(async () => true)
  }
}));

jest.mock('../src/services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    delete: jest.fn(async () => false),
    deleteByPrefix: jest.fn(async () => 0),
    clear: jest.fn(async () => undefined),
    getInfo: jest.fn(() => ({ backend: 'Memory', memorySize: 0 })),
    destroy: jest.fn(() => undefined)
  }
}));

import express from 'express';
import request from 'supertest';
import learnerRoutes from '../src/routes/learner.routes';
import feeRoutes from '../src/routes/fee.routes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { Role } from '../src/config/permissions';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.NODE_ENV = 'test';

const app = express();
app.use(express.json());
app.use('/api/learners', learnerRoutes);
app.use('/api/fees', feeRoutes);

describe('Fee collection end-to-end', () => {
  const authToken = generateAccessToken({
    id: 'test-super-admin-id',
    email: 'test-super-admin@example.com',
    role: 'SUPER_ADMIN' as Role,
    institutionType: 'PRIMARY_CBC',
  });

  const guardianPhone = '0713612141';
  const guardianEmail = 'fee-collection-parent@example.com';
  const learnerPayload = {
    firstName: 'Fee',
    lastName: 'Student',
    dateOfBirth: '2014-01-01',
    gender: 'MALE',
    grade: 'GRADE_1',
    stream: 'A',
    guardianName: 'Fee Parent',
    guardianPhone,
    guardianEmail,
  };

  let learnerId: string | null = null;
  let invoiceId: string | null = null;
  let parentId: string | null = null;
  let updatedFeeStructureId: string | null = null;
  let bulkFeeStructureId: string | null = null;
  let bulkInvoiceIds: string[] = [];

  beforeAll(async () => {
    const currentYear = new Date().getFullYear();

    await prisma.user.upsert({
      where: { id: 'test-super-admin-id' },
      update: {
        email: 'test-super-admin@example.com',
        username: 'test-super-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      },
      create: {
        id: 'test-super-admin-id',
        email: 'test-super-admin@example.com',
        username: 'test-super-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });

    await prisma.feeType.upsert({
      where: { code: 'TUITION' },
      update: { name: 'Tuition', category: 'ACADEMIC', description: 'Tuition fees', isActive: true },
      create: { code: 'TUITION', name: 'Tuition', category: 'ACADEMIC', description: 'Tuition fees', isActive: true }
    });

    await prisma.termConfig.upsert({
      where: { academicYear_term: { academicYear: currentYear, term: 'TERM_1' } },
      update: {
        startDate: new Date(currentYear, 0, 1),
        endDate: new Date(currentYear, 3, 30),
        formativeWeight: 30,
        summativeWeight: 70,
        isActive: true,
        isClosed: false,
        createdBy: 'test-super-admin-id'
      },
      create: {
        academicYear: currentYear,
        term: 'TERM_1',
        startDate: new Date(currentYear, 0, 1),
        endDate: new Date(currentYear, 3, 30),
        formativeWeight: 30,
        summativeWeight: 70,
        isActive: true,
        isClosed: false,
        createdBy: 'test-super-admin-id'
      }
    });

    const feeType = await prisma.feeType.findUnique({ where: { code: 'TUITION' } });
    if (!feeType) throw new Error('Failed to create fee type');

    const existingStructure = await prisma.feeStructure.findFirst({
      where: { grade: 'GRADE_1', term: 'TERM_1', academicYear: currentYear, active: true },
      include: { feeItems: true }
    });

    const existingFeeStructureId = existingStructure?.id;
    if (!existingStructure) {
      await prisma.feeStructure.create({
        data: {
          name: `Grade 1 TERM 1 Fees ${currentYear}`,
          description: 'Test fee structure for grade 1 term 1',
          grade: 'GRADE_1',
          term: 'TERM_1',
          academicYear: currentYear,
          mandatory: true,
          active: true,
          createdBy: 'test-super-admin-id',
          feeItems: {
            create: [{ feeTypeId: feeType.id, amount: '10000', mandatory: true }]
          }
        }
      });
    } else if (existingStructure.feeItems.length === 0) {
      await prisma.feeStructureItem.create({
        data: { feeStructureId: existingStructure.id, feeTypeId: feeType.id, amount: '10000', mandatory: true }
      });
    }
  });

  afterAll(async () => {
    if (invoiceId) {
      await prisma.feePayment.deleteMany({ where: { invoiceId } });
      await prisma.feeInvoice.deleteMany({ where: { id: invoiceId } });
    }
    if (learnerId) {
      await prisma.learner.deleteMany({ where: { id: learnerId } });
    }
    if (parentId) {
      await prisma.user.deleteMany({ where: { id: parentId } });
    } else {
      await prisma.user.deleteMany({ where: { email: guardianEmail } });
    }
    if (updatedFeeStructureId) {
      await prisma.feeStructure.deleteMany({ where: { id: updatedFeeStructureId } });
    }
    if (bulkInvoiceIds.length > 0) {
      await prisma.feeInvoice.deleteMany({ where: { id: { in: bulkInvoiceIds } } });
    }
    if (bulkFeeStructureId) {
      await prisma.feeInvoice.deleteMany({ where: { feeStructureId: bulkFeeStructureId } });
      await prisma.feeStructure.deleteMany({ where: { id: bulkFeeStructureId } });
    }
    await prisma.$disconnect();
  });

  it('creates learner, auto-generates invoice, and records a payment by learnerId', async () => {
    const learnerResponse = await request(app)
      .post('/api/learners')
      .set('Authorization', `Bearer ${authToken}`)
      .send(learnerPayload)
      .expect(201);

    expect(learnerResponse.body).toHaveProperty('success', true);
    expect(learnerResponse.body.data).toHaveProperty('id');
    learnerId = learnerResponse.body.data.id;
    parentId = learnerResponse.body.data.parent?.id || null;

    expect(learnerId).toBeTruthy();
    const invoice = await prisma.feeInvoice.findFirst({ where: { learnerId: learnerId! } });
    expect(invoice).toBeTruthy();
    expect(Number(invoice?.totalAmount || 0)).toBeGreaterThan(0);
    invoiceId = invoice?.id || null;

    const paymentResponse = await request(app)
      .post('/api/fees/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ learnerId, amount: 1000, paymentMethod: 'CASH' })
      .expect(201);

    expect(paymentResponse.body).toHaveProperty('success', true);
    expect(paymentResponse.body.data).toHaveProperty('payment');
    expect(paymentResponse.body.data).toHaveProperty('invoice');
    expect(paymentResponse.body.data.invoice).toHaveProperty('status');
    expect(['PENDING', 'PARTIAL', 'PAID']).toContain(paymentResponse.body.data.invoice.status);
  });

  it('marks an invoice as paid using the selected payment date', async () => {
    if (!invoiceId) throw new Error('Expected invoice from previous setup');

    const paymentDate = '2026-07-31';
    const response = await request(app)
      .post(`/api/fees/invoices/${invoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        paymentDate,
        paymentMethod: 'OTHER',
        referenceNumber: 'RECON-TERM2',
        notes: 'Manual paid reconciliation test'
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.invoice.status).toBe('PAID');

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { orderBy: { paymentDate: 'desc' } } }
    });
    expect(invoice?.status).toBe('PAID');
    expect(Number(invoice?.balance || 0)).toBeLessThanOrEqual(0);
    expect(invoice?.payments.some((payment) => payment.referenceNumber === 'RECON-TERM2')).toBe(true);
    const reconciledPayment = invoice?.payments.find((payment) => payment.referenceNumber === 'RECON-TERM2');
    expect(reconciledPayment?.paymentDate.toISOString().startsWith(paymentDate)).toBe(true);
  });

  it('creates and updates a fee structure while preserving normalized grade/term values', async () => {
    const feeType = await prisma.feeType.findUnique({ where: { code: 'TUITION' } });
    if (!feeType) throw new Error('Missing TUITION fee type');

    const currentYear = new Date().getFullYear();
    const targetAcademicYear = currentYear + 1;
    const structureName = `Update grade persistence ${targetAcademicYear} ${Date.now()}`;

    const createResponse = await request(app)
      .post('/api/fees/structures')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: structureName,
        description: 'Initial fee structure for normalization test',
        grade: 'grade 2',
        term: 'term 2',
        academicYear: targetAcademicYear,
        mandatory: true,
        active: true,
        feeItems: [{ feeTypeId: feeType.id, amount: '5000', mandatory: true }]
      })
      .expect(201);

    expect(createResponse.body).toHaveProperty('success', true);
    expect(createResponse.body.data).toHaveProperty('id');
    const structureId = createResponse.body.data.id;
    updatedFeeStructureId = structureId;

    expect(createResponse.body.data.grade).toBe('GRADE_2');
    expect(createResponse.body.data.term).toBe('TERM_2');

    const updateResponse = await request(app)
      .put(`/api/fees/structures/${structureId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `${structureName} - updated`,
        feeItems: [{ feeTypeId: feeType.id, amount: '7500', mandatory: true }]
      })
      .expect(200);

    expect(updateResponse.body).toHaveProperty('success', true);
    expect(updateResponse.body.data).toHaveProperty('id', structureId);
    expect(updateResponse.body.data.grade).toBe('GRADE_2');
    expect(updateResponse.body.data.term).toBe('TERM_2');
    expect(updateResponse.body.data.name).toBe(`${structureName} - updated`);
    expect(updateResponse.body.data.feeItems).toHaveLength(1);
    expect(updateResponse.body.data.feeItems[0].amount).toBe('7500');
  });

  it('bulk creates whole-school invoices using matching grade structures', async () => {
    if (!learnerId) throw new Error('Expected learner from previous setup');

    const feeType = await prisma.feeType.findUnique({ where: { code: 'TUITION' } });
    if (!feeType) throw new Error('Missing TUITION fee type');

    const bulkAcademicYear = 2090;
    await prisma.feeInvoice.deleteMany({
      where: { learnerId, term: 'TERM_3', academicYear: bulkAcademicYear }
    });

    const feeStructure = await prisma.feeStructure.upsert({
      where: {
        grade_term_academicYear: {
          grade: 'GRADE_1',
          term: 'TERM_3',
          academicYear: bulkAcademicYear
        }
      },
      update: {
        name: `Grade 1 TERM 3 Whole School Fees ${bulkAcademicYear}`,
        active: true,
        archived: false,
        feeItems: {
          deleteMany: {},
          create: [{ feeTypeId: feeType.id, amount: '12000', mandatory: true }]
        }
      },
      create: {
        name: `Grade 1 TERM 3 Whole School Fees ${bulkAcademicYear}`,
        description: 'Whole-school bulk generation test fee structure',
        grade: 'GRADE_1',
        term: 'TERM_3',
        academicYear: bulkAcademicYear,
        mandatory: true,
        active: true,
        createdBy: 'test-super-admin-id',
        feeItems: {
          create: [{ feeTypeId: feeType.id, amount: '12000', mandatory: true }]
        }
      }
    });
    bulkFeeStructureId = feeStructure.id;

    await prisma.feeInvoice.deleteMany({
      where: { feeStructureId: feeStructure.id, term: 'TERM_3', academicYear: bulkAcademicYear }
    });

    const response = await request(app)
      .post('/api/fees/invoices/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scope: 'WHOLE_SCHOOL',
        term: 'TERM_3',
        academicYear: bulkAcademicYear,
        dueDate: `${bulkAcademicYear}-08-23`
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.count).toBeGreaterThan(0);
    expect(response.body.message).toContain('whole school scope');
    expect(response.body.data[0]).toHaveProperty('feeStructureId', feeStructure.id);

    bulkInvoiceIds = response.body.data.map((invoice: any) => invoice.id);

    const markPaidResponse = await request(app)
      .post('/api/fees/invoices/mark-paid/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        invoiceIds: bulkInvoiceIds.slice(0, 2),
        paymentDate: `${bulkAcademicYear}-08-24`,
        paymentMethod: 'OTHER',
        referenceNumber: 'BULK-RECON'
      })
      .expect(201);

    expect(markPaidResponse.body).toHaveProperty('success', true);
    expect(markPaidResponse.body.count).toBeGreaterThan(0);
    expect(markPaidResponse.body.data.paid.length).toBe(markPaidResponse.body.count);
  });
});
