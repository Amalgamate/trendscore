/**
 * Attendance Routes
 * Handles attendance marking and reporting endpoints
 * 
 * @module routes/attendance.routes
 */

import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission, requirePermission, auditLog } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { z } from 'zod';

const router = Router();
const attendanceController = new AttendanceController();

const markAttendanceSchema = z.object({
  learnerId: z.string().min(1),
  date: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]).optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK']),
  classId: z.string().min(1).optional(),
  remarks: z.string().max(255).optional()
});

const attendanceItemSchema = z.object({
  learnerId: z.string().min(1),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK']),
  remarks: z.string().max(255).optional(),
});

const bulkAttendanceSchema = z.object({
  classId: z.string().min(1).optional(),
  date: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ]).optional(),
  attendanceRecords: z.array(attendanceItemSchema).optional(),
  attendance: z.array(attendanceItemSchema).optional(),
}).refine((data) => Array.isArray(data.attendanceRecords) || Array.isArray(data.attendance), {
  message: 'attendanceRecords (array) is required',
});

/**
 * @route   POST /api/attendance
 * @desc    Mark attendance for single learner
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/',
  authenticate,
  requirePermission('MARK_ATTENDANCE'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  validate(markAttendanceSchema),
  auditLog('MARK_ATTENDANCE'),
  asyncHandler(attendanceController.markAttendance.bind(attendanceController))
);

/**
 * @route   POST /api/attendance/bulk
 * @desc    Mark attendance for multiple learners
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/bulk',
  authenticate,
  requirePermission('MARK_ATTENDANCE'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(bulkAttendanceSchema),
  auditLog('MARK_BULK_ATTENDANCE'),
  asyncHandler(attendanceController.markBulkAttendance.bind(attendanceController))
);

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.get(
  '/',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  requireAnyPermission(['VIEW_ALL_ATTENDANCE', 'VIEW_OWN_ATTENDANCE']),
  asyncHandler(attendanceController.getAttendance.bind(attendanceController))
);

/**
 * @route   GET /api/attendance/stats
 * @desc    Get attendance statistics
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.get(
  '/stats',
  authenticate,
  requireAnyPermission(['VIEW_ALL_ATTENDANCE', 'VIEW_OWN_ATTENDANCE']),
  asyncHandler(attendanceController.getAttendanceStats.bind(attendanceController))
);

/**
 * @route   GET /api/attendance/learner/:learnerId
 * @desc    Get learner attendance summary
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER, PARENT (own children), STUDENT (self)
 */
router.get(
  '/learner/:learnerId',
  authenticate,
  asyncHandler(attendanceController.getLearnerAttendanceSummary.bind(attendanceController))
);

/**
 * @route   GET /api/attendance/class/daily
 * @desc    Get daily attendance report for a class
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.get(
  '/class/daily',
  authenticate,
  requireAnyPermission(['VIEW_ALL_ATTENDANCE', 'VIEW_OWN_ATTENDANCE']),
  asyncHandler(attendanceController.getDailyClassAttendance.bind(attendanceController))
);

export default router;
