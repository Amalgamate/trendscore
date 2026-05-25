/// <reference types="jest" />

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
import configRoutes from '../src/routes/config.routes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { Role } from '../src/config/permissions';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.NODE_ENV = 'test';

const app = express();
app.use(express.json());
app.use('/api/config', configRoutes);

describe('Settings module end-to-end', () => {
  const authToken = generateAccessToken({
    id: 'test-settings-admin-id',
    email: 'test-settings-admin@example.com',
    role: 'SUPER_ADMIN' as Role,
    institutionType: 'PRIMARY_CBC',
  });

  const testYear = new Date().getFullYear() + 4;
  const aggregationLearningArea = `TEST_MATH_${Date.now()}`;

  let termConfigId: string | null = null;
  let aggregationConfigId: string | null = null;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: 'test-settings-admin-id' },
      update: {
        email: 'test-settings-admin@example.com',
        username: 'test-settings-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Settings',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      },
      create: {
        id: 'test-settings-admin-id',
        email: 'test-settings-admin@example.com',
        username: 'test-settings-admin',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'Settings',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    await prisma.aggregationConfig.deleteMany({ where: { createdBy: 'test-settings-admin-id' } }).catch(() => null);
    if (termConfigId) {
      await prisma.termConfig.deleteMany({ where: { id: termConfigId } }).catch(() => null);
    }
    await prisma.user.deleteMany({ where: { id: 'test-settings-admin-id' } }).catch(() => null);
    await prisma.$disconnect();
  });

  it('returns grade options and strategies', async () => {
    const gradesResponse = await request(app)
      .get('/api/config/grades')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(gradesResponse.body.success).toBe(true);
    expect(Array.isArray(gradesResponse.body.data)).toBe(true);
    expect(gradesResponse.body.data).toContain('GRADE_1');

    const strategiesResponse = await request(app)
      .get('/api/config/strategies')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(strategiesResponse.body.success).toBe(true);
    expect(Array.isArray(strategiesResponse.body.data)).toBe(true);
    expect(strategiesResponse.body.data.some((item: any) => item.id === 'SIMPLE_AVERAGE')).toBe(true);
  });

  it('creates and updates a term configuration', async () => {
    const createResponse = await request(app)
      .post('/api/config/term')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        academicYear: testYear,
        term: 'TERM_1',
        startDate: `${testYear}-01-01`,
        endDate: `${testYear}-04-30`,
        formativeWeight: 30,
        summativeWeight: 70,
        isActive: false
      })
      .expect(200);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toHaveProperty('id');
    expect(createResponse.body.data).toHaveProperty('academicYear', testYear);
    expect(createResponse.body.data).toHaveProperty('term', 'TERM_1');
    termConfigId = createResponse.body.data.id;

    const getResponse = await request(app)
      .get(`/api/config/term/TERM_1/${testYear}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(getResponse.body.success).toBe(true);
    expect(getResponse.body.data).toHaveProperty('id', termConfigId);

    const updateResponse = await request(app)
      .put(`/api/config/term/${termConfigId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        formativeWeight: 40,
        summativeWeight: 60
      })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data).toHaveProperty('formativeWeight', 40);
    expect(updateResponse.body.data).toHaveProperty('summativeWeight', 60);
  });

  it('creates, fetches, updates, and deletes an aggregation configuration', async () => {
    const createResponse = await request(app)
      .post('/api/config/aggregation')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'OPENER',
        strategy: 'SIMPLE_AVERAGE',
        grade: 'GRADE_1',
        learningArea: aggregationLearningArea,
        weight: 10
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    aggregationConfigId = createResponse.body.data.id;
    expect(createResponse.body.data).toHaveProperty('strategy', 'SIMPLE_AVERAGE');
    expect(createResponse.body.data).toHaveProperty('learningArea', aggregationLearningArea);

    const getSpecific = await request(app)
      .get(`/api/config/aggregation/OPENER`)
      .query({ grade: 'GRADE_1', learningArea: aggregationLearningArea })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(getSpecific.body.success).toBe(true);
    expect(getSpecific.body.data).toHaveProperty('id', aggregationConfigId);

    const updateResponse = await request(app)
      .put(`/api/config/aggregation/${aggregationConfigId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ strategy: 'MEDIAN' })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data).toHaveProperty('strategy', 'MEDIAN');

    await request(app)
      .delete(`/api/config/aggregation/${aggregationConfigId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    aggregationConfigId = null;
  });

  it('returns configuration summary', async () => {
    const summaryResponse = await request(app)
      .get('/api/config/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(summaryResponse.body.success).toBe(true);
    expect(summaryResponse.body.data).toHaveProperty('stats');
    expect(summaryResponse.body.data.stats).toHaveProperty('students');
    expect(summaryResponse.body.data.stats).toHaveProperty('classes');
  });
});
