/// <reference types="jest" />

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import lmsRoutes from '../src/routes/lms.routes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { UserRole } from '@prisma/client';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const app = express();
app.use(express.json());
app.use('/api/lms', lmsRoutes);

describe('LMS Courses API', () => {
  const testUserEmail = 'test-lms-creator@local.test';
  let authToken: string;
  let createdCourseId: string | null = null;
  let testUserId: string | null = null;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: testUserEmail },
      update: {},
      create: {
        id: '00000000-0000-4000-8000-000000000003',
        email: testUserEmail,
        password: 'TestPassword!23',
        firstName: 'Test',
        lastName: 'LMS Creator',
        role: UserRole.TEACHER,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    testUserId = user.id;
    authToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      institutionType: 'SECONDARY',
    });
  });

  afterAll(async () => {
    if (createdCourseId) {
      await prisma.lMSCourse.deleteMany({ where: { id: createdCourseId } });
    }

    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }

    await prisma.$disconnect();
  });

  it('creates a new LMS course and retrieves it by ID', async () => {
    const payload = {
      title: 'Test Course for LMS API',
      description: 'A test course created during integration testing.',
      subject: 'Mathematics',
      grade: 'GRADE_10',
      category: 'Core Subject',
      status: 'PUBLISHED',
    };

    const createResponse = await request(app)
      .post('/api/lms/courses')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload)
      .expect(201);

    expect(createResponse.body).toHaveProperty('success', true);
    expect(createResponse.body).toHaveProperty('data');
    expect(createResponse.body.data).toMatchObject({
      title: payload.title,
      subject: payload.subject,
      grade: payload.grade,
      category: payload.category,
      status: payload.status,
      createdById: testUserId,
    });

    createdCourseId = createResponse.body.data.id;
    expect(createdCourseId).toBeTruthy();

    const getResponse = await request(app)
      .get(`/api/lms/courses/${createdCourseId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(getResponse.body).toHaveProperty('success', true);
    expect(getResponse.body.data).toHaveProperty('id', createdCourseId);
    expect(getResponse.body.data).toHaveProperty('title', payload.title);
  });
});
