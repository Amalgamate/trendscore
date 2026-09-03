/**
 * Subject Assignment Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { subjectAssignmentController } from '../controllers/subjectAssignment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { asyncHandler } from '../utils/async.util';

const router = Router();

// Validation schemas
const createAssignmentSchema = z.object({
  teacherId:      z.string().min(1),
  learningAreaId: z.string().min(1),
  grade:          z.string().min(1),
  classId:        z.string().min(1).optional(),
});

/**
 * @route   GET /api/subject-assignments
 * @desc    Get all subject assignments
 */
router.get(
    '/',
    authenticate,
    requireSchoolContext,
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    asyncHandler(subjectAssignmentController.getAllAssignments.bind(subjectAssignmentController))
);

/**
 * @route   POST /api/subject-assignments
 * @desc    Assign a teacher to a subject
 */
router.post(
    '/',
    authenticate,
    requireSchoolContext,
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(createAssignmentSchema),
    auditLog('CREATE_SUBJECT_ASSIGNMENT'),
    asyncHandler(subjectAssignmentController.createAssignment.bind(subjectAssignmentController))
);

/**
 * @route   DELETE /api/subject-assignments/:id
 * @desc    Remove an assignment
 */
router.delete(
    '/:id',
    authenticate,
    requireSchoolContext,
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('DELETE_SUBJECT_ASSIGNMENT'),
    asyncHandler(subjectAssignmentController.removeAssignment.bind(subjectAssignmentController))
);

/**
 * @route   GET /api/subject-assignments/eligible-teachers
 * @desc    Get teachers assigned to a subject in a grade
 */
router.get(
    '/eligible-teachers',
    authenticate,
    requireSchoolContext,
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    asyncHandler(subjectAssignmentController.getEligibleTeachers.bind(subjectAssignmentController))
);

export default router;
