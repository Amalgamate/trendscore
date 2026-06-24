import { Router } from 'express';
import { z } from 'zod';
import { EventType } from '@prisma/client';
import { PlannerController } from '../controllers/planner.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();
const controller = new PlannerController();

// Align with PlannerController + Prisma Event model
const createEventSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  type: z.nativeEnum(EventType).optional(),
  allDay: z.boolean().optional(),
  location: z.string().max(500).optional().nullable(),
  meetingLink: z.string().max(2000).optional().nullable(),
  isParentVisible: z.boolean().optional(),
  academicYear: z.number().int().optional().nullable(),
  term: z.string().optional().nullable(),
});

const updateEventSchema = createEventSchema.partial();

const bulkCreateEventSchema = z.object({
  events: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(2).max(200),
      description: z.string().max(1000).optional().nullable(),
      startDate: z.string(),
      endDate: z.string(),
      type: z.nativeEnum(EventType).optional(),
      allDay: z.boolean().optional(),
      location: z.string().max(500).optional().nullable(),
      meetingLink: z.string().max(2000).optional().nullable(),
      isParentVisible: z.boolean().optional(),
      academicYear: z.number().int().optional().nullable(),
      term: z.string().optional().nullable(),
    })
  )
});

// Apply auth middleware to all routes
router.use(authenticate);

/**
 * @route   GET /api/planner/events
 * @desc    Get all planner events
 * @access  Authenticated
 */
router.get(
  '/events',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  controller.getEvents
);

/**
 * @route   GET /api/planner/events/annual-summary
 * @desc    Get annual summary of events grouped by term
 * @access  Authenticated
 */
router.get(
  '/events/annual-summary',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  controller.getAnnualSummary
);

/**
 * @route   POST /api/planner/events
 * @desc    Create event (Admin, Head Teacher, Teacher)
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/events',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(createEventSchema),
  auditLog('CREATE_PLANNER_EVENT'),
  controller.createEvent
);

/**
 * @route   POST /api/planner/events/bulk-annual
 * @desc    Bulk create/update events
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.post(
  '/events/bulk-annual',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(bulkCreateEventSchema),
  auditLog('BULK_CREATE_PLANNER_EVENTS'),
  controller.bulkCreateAnnualPlan
);

/**
 * @route   PUT /api/planner/events/:id
 * @desc    Update event
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.put(
  '/events/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(updateEventSchema),
  auditLog('UPDATE_PLANNER_EVENT'),
  controller.updateEvent
);

/**
 * @route   DELETE /api/planner/events/:id
 * @desc    Delete event
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.delete(
  '/events/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('DELETE_PLANNER_EVENT'),
  controller.deleteEvent
);

export default router;
