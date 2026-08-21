/// <reference types="jest" />

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import lmsRoutes from '../src/routes/lms.routes';
import prisma from '../src/config/database';
import { generateAccessToken } from '../src/utils/jwt.util';
import { UserRole, Gender, LearnerStatus } from '@prisma/client';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.school = { id: 'lms-e2e-school-id', name: 'LMS E2E Academy', institutionType: 'SECONDARY' };
  next();
});
app.use('/api/lms', lmsRoutes);

describe('LMS Courses, Enrollments & Student Portal API', () => {
  const testUserEmail = 'test-lms-creator@local.test';
  const studentUserEmail = 'student-lms@local.test';
  const testLearnerAdm = 'LMS-TEST-E2E';

  let authToken: string;
  let studentAuthToken: string;

  let createdCourseId: string | null = null;
  let testUserId: string | null = null;
  let testStudentUserId: string | null = null;
  let testLearnerId: string | null = null;
  let testClassId: string | null = null;
  let createdEnrollmentId: string | null = null;

  beforeAll(async () => {
    await prisma.school.upsert({
      where: { name: 'LMS E2E Academy' },
      update: {
        active: true,
        status: 'ACTIVE',
        archived: false,
        institutionType: 'SECONDARY',
        institutionTypeLocked: true,
        requiresUserVerification: false,
      },
      create: {
        id: 'lms-e2e-school-id',
        name: 'LMS E2E Academy',
        active: true,
        status: 'ACTIVE',
        institutionType: 'SECONDARY',
        institutionTypeLocked: true,
        requiresUserVerification: false,
        curriculumType: 'CBC_AND_EXAM',
      },
    });

    // 1. Create a Head Teacher User
    const user = await prisma.user.upsert({
      where: { email: testUserEmail },
      update: {
        role: UserRole.HEAD_TEACHER,
      },
      create: {
        id: '00000000-0000-4000-8000-000000000003',
        email: testUserEmail,
        password: 'TestPassword!23',
        firstName: 'Test',
        lastName: 'LMS Creator',
        role: UserRole.HEAD_TEACHER,
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

    // 2. Create a Learner for Enrollment testing
    const learner = await prisma.learner.upsert({
      where: { admissionNumber: testLearnerAdm },
      update: {},
      create: {
        admissionNumber: testLearnerAdm,
        firstName: 'LMS',
        lastName: 'E2E',
        dateOfBirth: new Date('2010-01-01'),
        gender: Gender.MALE,
        grade: 'GRADE_10',
        status: LearnerStatus.ACTIVE,
      },
    });
    testLearnerId = learner.id;

    // 3. Create a Student User matching the learner's admission number
    const studentUser = await prisma.user.upsert({
      where: { email: studentUserEmail },
      update: {
        username: testLearnerAdm,
        role: UserRole.STUDENT,
      },
      create: {
        id: '00000000-0000-4000-8000-000000000004',
        email: studentUserEmail,
        username: testLearnerAdm,
        password: 'TestPassword!23',
        firstName: 'LMS',
        lastName: 'E2E Student',
        role: UserRole.STUDENT,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    testStudentUserId = studentUser.id;

    await prisma.learner.update({
      where: { id: learner.id },
      data: { studentUserId: studentUser.id },
    });

    // Assignment visibility follows the school's active class roster, not the
    // legacy LMS course enrollment used by the course portal tests below.
    const schoolClass = await prisma.class.upsert({
      where: { classCode: 'LMS-E2E-CLASS' },
      update: { active: true, archived: false },
      create: {
        classCode: 'LMS-E2E-CLASS',
        name: 'LMS E2E Class',
        grade: 'GRADE_10',
        stream: 'LMS_E2E',
        academicYear: 2099,
        active: true,
      },
    });
    testClassId = schoolClass.id;
    await prisma.classEnrollment.upsert({
      where: { classId_learnerId: { classId: schoolClass.id, learnerId: learner.id } },
      update: { active: true, archived: false },
      create: { classId: schoolClass.id, learnerId: learner.id },
    });

    studentAuthToken = generateAccessToken({
      id: studentUser.id,
      email: studentUser.email,
      role: studentUser.role,
      institutionType: 'SECONDARY',
    });
  });

  afterAll(async () => {
    // Step 1: remove progress records and enrollments referencing this learner
    if (testLearnerId) {
      await prisma.classEnrollment.deleteMany({ where: { learnerId: testLearnerId } });
      const enrollments = await prisma.lMSEnrollment.findMany({
        where: { learnerId: testLearnerId },
        select: { id: true },
      });
      const enrollmentIds = enrollments.map((e) => e.id);
      if (enrollmentIds.length) {
        await prisma.lMSProgress.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
      }
      await prisma.lMSEnrollment.deleteMany({ where: { learnerId: testLearnerId } });
    }
    // Step 2: remove all courses created by the test teacher user (and their content, progress, and enrollments)
    if (testUserId) {
      const staleCourses = await prisma.lMSCourse.findMany({
        where: { createdById: testUserId },
        select: { id: true },
      });
      if (staleCourses.length) {
        const ids = staleCourses.map((c) => c.id);
        const enrollments = await prisma.lMSEnrollment.findMany({
          where: { courseId: { in: ids } },
          select: { id: true },
        });
        const enrollmentIds = enrollments.map((e) => e.id);
        if (enrollmentIds.length) {
          await prisma.lMSProgress.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
        }
        await prisma.lMSEnrollment.deleteMany({ where: { courseId: { in: ids } } });
        await prisma.lMSContent.deleteMany({ where: { courseId: { in: ids } } });
        await prisma.lMSCourse.deleteMany({ where: { id: { in: ids } } });
      }
    }
    // Step 3: remove learner then both user records
    if (testLearnerId) {
      await prisma.learner.deleteMany({ where: { id: testLearnerId } });
    }
    if (testStudentUserId) {
      await prisma.user.deleteMany({ where: { id: testStudentUserId } });
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (testClassId) {
      await prisma.class.deleteMany({ where: { id: testClassId } });
    }
    await prisma.school.deleteMany({ where: { id: 'lms-e2e-school-id' } }).catch(() => null);
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

  it('retrieves LMS dashboard statistics', async () => {
    const statsResponse = await request(app)
      .get('/api/lms/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statsResponse.body).toHaveProperty('success', true);
    expect(statsResponse.body).toHaveProperty('data');
    expect(statsResponse.body.data).toHaveProperty('totalCourses');
    expect(statsResponse.body.data).toHaveProperty('totalEnrollments');
    expect(statsResponse.body.data).toHaveProperty('activeEnrollments');
    expect(statsResponse.body.data).toHaveProperty('totalContent');
    expect(statsResponse.body.data).toHaveProperty('recentEnrollments');
  });

  it('manages learner enrollments and student portal access', async () => {
    // 1. Enroll Student (Teacher action)
    const enrollPayload = {
      courseId: createdCourseId,
      learnerId: testLearnerId,
    };

    const enrollResponse = await request(app)
      .post('/api/lms/enrollments')
      .set('Authorization', `Bearer ${authToken}`)
      .send(enrollPayload)
      .expect(201);

    expect(enrollResponse.body).toHaveProperty('success', true);
    createdEnrollmentId = enrollResponse.body.data.id;

    // 2. Student Portal: Fetch enrolled courses
    const studentCoursesResponse = await request(app)
      .get('/api/lms/my-courses')
      .set('Authorization', `Bearer ${studentAuthToken}`)
      .expect(200);

    expect(studentCoursesResponse.body).toHaveProperty('success', true);
    expect(studentCoursesResponse.body.data).toBeInstanceOf(Array);
    expect(studentCoursesResponse.body.data.length).toBeGreaterThan(0);
    expect(studentCoursesResponse.body.data[0]).toHaveProperty('courseId', createdCourseId);

    // 3. Student Portal: Fetch course detail
    const studentCourseDetailResponse = await request(app)
      .get(`/api/lms/my-courses/${createdCourseId}`)
      .set('Authorization', `Bearer ${studentAuthToken}`)
      .expect(200);

    expect(studentCourseDetailResponse.body).toHaveProperty('success', true);
    expect(studentCourseDetailResponse.body.data).toHaveProperty('courseId', createdCourseId);

    // 4. Student Portal: Fetch assignments
    const studentAssignmentsResponse = await request(app)
      .get('/api/lms/my-assignments')
      .set('Authorization', `Bearer ${studentAuthToken}`)
      .expect(200);

    expect(studentAssignmentsResponse.body).toHaveProperty('success', true);
    expect(studentAssignmentsResponse.body.data).toBeInstanceOf(Array);

    // 5. Unenroll / Clean up enrollment (Teacher action)
    await request(app)
      .delete(`/api/lms/enrollments/${createdEnrollmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    createdEnrollmentId = null;
  });
});
