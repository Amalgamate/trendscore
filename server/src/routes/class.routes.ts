/**
 * class.routes.ts
 *
 * Guard contract:
 *   - authenticate — applied once in index.ts; NOT repeated here
 *   - requireRole  — applied per-route for all write/admin operations
 *   - requireSchoolContext — kept per-route (needed for req.school resolution)
 *
 * NOTE: createClassSchema currently enumerates Primary CBC grades only
 * (Grade1–Grade6).  Secondary classes (Grade10–Grade12) require a different
 * or extended grade set.  Extend the schema in Chunk 6 when Secondary class
 * creation is added.
 */

import { Router } from 'express';
import { ClassController } from '../controllers/class.controller';
import { requireSchoolContext } from '../middleware/school.middleware';
import { requirePermission, requireRole, auditLog } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { z } from 'zod';

const router = Router();
const classController = new ClassController();

// ── Validation schemas ───────────────────────────────────────────────────────

const createClassSchema = z.object({
  name: z.string().min(2).max(100),
  grade: z.enum([
    'PLAYGROUP', 'PP1', 'PP2',
    'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9',
    'GRADE10', 'GRADE11', 'GRADE12',
    'GRADE_10', 'GRADE_11', 'GRADE_12',
    'Grade1', 'Grade2', 'Grade3', 'Grade4', 'Grade5', 'Grade6',
    'Grade 10', 'Grade 11', 'Grade 12'
  ]),
  classTeacherId: z.string().min(1).optional(),
  capacity: z.coerce.number().int().min(1).optional()
});

const updateClassSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  classTeacherId: z.string().min(1).optional(),
  capacity: z.coerce.number().int().min(1).optional()
});

// authenticate is applied in index.ts — do NOT add authenticate here

/**
 * @route   GET /api/classes
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM, TEACHER (VIEW_ALL_LEARNERS)
 */
router.get('/',
  requireSchoolContext,
  requirePermission('VIEW_ALL_LEARNERS'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(classController.getAllClasses.bind(classController))
);

/**
 * @route   GET /api/classes/:id
 * @access  VIEW_ALL_LEARNERS
 */
router.get(
  '/:id',
  requireSchoolContext,
  requirePermission('VIEW_ALL_LEARNERS'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(classController.getClassById.bind(classController))
);

/**
 * @route   POST /api/classes
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.post(
  '/',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createClassSchema),
  auditLog('CREATE_CLASS'),
  asyncHandler(classController.createClass.bind(classController))
);

/**
 * @route   PUT /api/classes/:id
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.put(
  '/:id',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  auditLog('UPDATE_CLASS'),
  asyncHandler(classController.updateClass.bind(classController))
);

/**
 * @route   POST /api/classes/enroll
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.post(
  '/enroll',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  auditLog('ENROLL_LEARNER'),
  asyncHandler(classController.enrollLearner.bind(classController))
);

/**
 * @route   POST /api/classes/unenroll
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.post(
  '/unenroll',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  auditLog('UNENROLL_LEARNER'),
  asyncHandler(classController.unenrollLearner.bind(classController))
);

/**
 * @route   GET /api/classes/learner/:learnerId
 * @access  Any authenticated user with school context
 */
router.get(
  '/learner/:learnerId',
  requireSchoolContext,
  asyncHandler(classController.getLearnerClass.bind(classController))
);

/**
 * @route   POST /api/classes/assign-teacher
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.post(
  '/assign-teacher',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('ASSIGN_TEACHER'),
  asyncHandler(classController.assignTeacher.bind(classController))
);

/**
 * @route   POST /api/classes/unassign-teacher
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.post(
  '/unassign-teacher',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  auditLog('UNASSIGN_TEACHER'),
  asyncHandler(classController.unassignTeacher.bind(classController))
);

/**
 * @route   GET /api/classes/teacher/:teacherId/workload
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM, TEACHER
 */
router.get(
  '/teacher/:teacherId/workload',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER']),
  asyncHandler(classController.getTeacherWorkload.bind(classController))
);

/**
 * @route   GET /api/classes/teacher/:teacherId/schedules
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM, TEACHER
 */
router.get(
  '/teacher/:teacherId/schedules',
  requireSchoolContext,
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'TEACHER']),
  asyncHandler(classController.getTeacherSchedules.bind(classController))
);

/**
 * @route   GET /api/classes/:id/schedules
 */
router.get(
  '/:id/schedules',
  requireSchoolContext,
  asyncHandler(classController.getClassSchedules.bind(classController))
);

/**
 * @route   POST /api/classes/:id/schedules
 * @access  EDIT_TIMETABLE
 */
router.post(
  '/:id/schedules',
  requireSchoolContext,
  requirePermission('EDIT_TIMETABLE'),
  asyncHandler(classController.createClassSchedule.bind(classController))
);

/**
 * @route   PUT /api/classes/:id/schedules/:scheduleId
 * @access  EDIT_TIMETABLE
 */
router.put(
  '/:id/schedules/:scheduleId',
  requireSchoolContext,
  requirePermission('EDIT_TIMETABLE'),
  asyncHandler(classController.updateClassSchedule.bind(classController))
);

/**
 * @route   DELETE /api/classes/:id/schedules/:scheduleId
 * @access  EDIT_TIMETABLE
 */
router.delete(
  '/:id/schedules/:scheduleId',
  requireSchoolContext,
  requirePermission('EDIT_TIMETABLE'),
  asyncHandler(classController.deleteClassSchedule.bind(classController))
);

export default router;
