import { Router } from 'express';
import { z } from 'zod';
import { Term, TimetableLessonType, TimetablePeriodType, TimetableRoomType, TimetableVersionStatus } from '@prisma/client';
import { requirePermission } from '../../middleware/permissions.middleware';
import { validate } from '../../middleware/validation.middleware';
import { timetableController } from './timetable.controller';

const router = Router();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

const bellScheduleSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  periods: z.object({
    create: z.array(z.object({
      name: z.string().min(2).max(100), sequence: z.number().int().positive(),
      startTime: time, endTime: time, type: z.nativeEnum(TimetablePeriodType).optional(),
      instructional: z.boolean().optional(), active: z.boolean().optional()
    })).min(1)
  })
});

const roomSchema = z.object({
  name: z.string().min(2).max(100), code: z.string().max(30).optional(),
  type: z.nativeEnum(TimetableRoomType).optional(), capacity: z.number().int().positive().optional(),
  building: z.string().max(100).optional(), floor: z.string().max(50).optional(),
  equipment: z.array(z.string().max(100)).optional(), active: z.boolean().optional(), notes: z.string().max(500).optional()
});

const allocationSchema = z.object({
  academicYear: z.number().int().min(2020).max(2100), grade: z.string().min(2).max(50), learningAreaId: z.string().uuid(),
  minimumWeeklyPeriods: z.number().int().min(0).optional(), targetWeeklyPeriods: z.number().int().positive(),
  maximumWeeklyPeriods: z.number().int().positive().nullable().optional(), preferredDuration: z.number().int().positive().nullable().optional(),
  requiresDouble: z.boolean().optional(), requiredRoomType: z.nativeEnum(TimetableRoomType).nullable().optional(),
  sourceReference: z.string().max(500).nullable().optional(), active: z.boolean().optional()
});

const availabilitySchema = z.object({
  teacherId: z.string().uuid(), day, startTime: time, endTime: time,
  available: z.boolean().optional(), reason: z.string().max(300).optional()
});

const planSchema = z.object({
  name: z.string().min(2).max(120), academicYear: z.number().int().min(2020).max(2100),
  term: z.nativeEnum(Term), bellScheduleId: z.string().uuid(), description: z.string().max(500).optional()
});

const entrySchema = z.object({
  id: z.string().uuid().optional(), classId: z.string().uuid(), learningAreaId: z.string().uuid(),
  teacherId: z.string().uuid().nullable().optional(), roomId: z.string().uuid().nullable().optional(),
  bellPeriodId: z.string().uuid().nullable().optional(), day, startTime: time, endTime: time,
  lessonType: z.nativeEnum(TimetableLessonType).optional(), locked: z.boolean().optional(), notes: z.string().max(500).optional()
});

router.get('/foundation', requirePermission('ACCESS_TIMETABLE'), timetableController.foundation);
router.post('/bell-schedules', requirePermission('EDIT_TIMETABLE'), validate(bellScheduleSchema), timetableController.createBellSchedule);
router.patch('/bell-schedules/:bellScheduleId', requirePermission('EDIT_TIMETABLE'), validate(z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, 'At least one field is required')), timetableController.updateBellSchedule);
router.patch('/bell-schedules/periods/:periodId', requirePermission('EDIT_TIMETABLE'), validate(z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.nativeEnum(TimetablePeriodType).optional(),
  instructional: z.boolean().optional(),
  active: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, 'At least one field is required')), timetableController.updateBellPeriod);
router.post('/rooms', requirePermission('EDIT_TIMETABLE'), validate(roomSchema), timetableController.createRoom);
router.patch('/rooms/:roomId', requirePermission('EDIT_TIMETABLE'), validate(z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().max(30).optional(),
  type: z.nativeEnum(TimetableRoomType).optional(),
  capacity: z.number().int().positive().optional(),
  building: z.string().max(100).optional(),
  floor: z.string().max(50).optional(),
  active: z.boolean().optional(),
  notes: z.string().max(500).optional(),
}).refine(v => Object.keys(v).length > 0, 'At least one field is required')), timetableController.updateRoom);
router.put('/instructional-allocations', requirePermission('EDIT_TIMETABLE'), validate(allocationSchema), timetableController.upsertAllocation);
router.put('/teacher-availability', requirePermission('EDIT_TIMETABLE'), validate(availabilitySchema), timetableController.upsertAvailability);
router.post('/plans', requirePermission('EDIT_TIMETABLE'), validate(planSchema), timetableController.createPlan);
router.get('/plans/:planId/versions', requirePermission('ACCESS_TIMETABLE'), timetableController.listVersions);
router.get('/versions/:versionId/entries', requirePermission('ACCESS_TIMETABLE'), timetableController.entries);
router.put('/versions/:versionId/entries', requirePermission('EDIT_TIMETABLE'), validate(z.object({ entries: z.array(entrySchema) })), timetableController.replaceEntries);
router.patch('/versions/:versionId/entries/:entryId', requirePermission('EDIT_TIMETABLE'), validate(z.object({
  day: day.optional(), startTime: time.optional(), endTime: time.optional(), bellPeriodId: z.string().uuid().nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(), roomId: z.string().uuid().nullable().optional(),
  learningAreaId: z.string().uuid().optional(), lessonType: z.nativeEnum(TimetableLessonType).optional(),
  locked: z.boolean().optional(), notes: z.string().max(500).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required')), timetableController.updateEntry);
router.get('/versions/:versionId/conflicts', requirePermission('ACCESS_TIMETABLE'), timetableController.conflicts);
router.get('/versions/:versionId/analytics', requirePermission('ACCESS_TIMETABLE'), timetableController.analytics);
router.post('/versions/:versionId/transition', requirePermission('EDIT_TIMETABLE'), validate(z.object({ status: z.nativeEnum(TimetableVersionStatus) })), timetableController.transition);
router.post('/versions/:versionId/clone', requirePermission('EDIT_TIMETABLE'), timetableController.clone);
router.post('/versions/:versionId/generate', requirePermission('EDIT_TIMETABLE'), validate(z.object({
  classIds: z.array(z.string().uuid()).optional(),
  days: z.array(day).min(1).optional(),
  maxDailyLessons: z.number().int().min(1).max(20).optional(),
  randomSeed: z.number().int().optional()
})), timetableController.generate);
router.post('/versions/:versionId/publish', requirePermission('EDIT_TIMETABLE'), timetableController.publish);
router.get('/versions/:versionId/override-count', requirePermission('ACCESS_TIMETABLE'), timetableController.overrideCount);

export default router;
