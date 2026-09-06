import { NextFunction, Response } from 'express';
import { TimetableChangeRequestStatus } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth.middleware';
import { hasPermission } from '../../config/permissions';
import type { Role } from '../../config/permissions';
import { timetableService } from './timetable.service';
import { automaticGeneratorService } from './automatic-generator.service';
import { timetableChangeRequestService } from './change-requests.service';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

export class TimetableController {
  foundation = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.foundation()); } catch (error) { return next(error); }
  };

  createBellSchedule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.createBellSchedule(req.body), 201); } catch (error) { return next(error); }
  };

  updateBellSchedule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.updateBellSchedule(req.params.bellScheduleId, req.body)); } catch (error) { return next(error); }
  };

  updateBellPeriod = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cascade = req.query.cascade !== 'false'; // default true
      return ok(res, await timetableService.updateBellPeriod(req.params.periodId, req.body, cascade));
    } catch (error) { return next(error); }
  };

  createRoom = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.createRoom(req.body), 201); } catch (error) { return next(error); }
  };

  updateRoom = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.updateRoom(req.params.roomId, req.body)); } catch (error) { return next(error); }
  };

  upsertAllocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.upsertAllocation(req.body)); } catch (error) { return next(error); }
  };

  upsertAvailability = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.upsertTeacherAvailability(req.body)); } catch (error) { return next(error); }
  };

  createPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return ok(res, await timetableService.createPlan({ ...req.body, createdById: req.user?.userId }), 201);
    } catch (error) { return next(error); }
  };

  listVersions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.listVersions(req.params.planId)); } catch (error) { return next(error); }
  };

  entries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.versionEntries(req.params.versionId)); } catch (error) { return next(error); }
  };

  replaceEntries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.replaceVersionEntries(req.params.versionId, req.body.entries)); } catch (error) { return next(error); }
  };

  updateEntry = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.updateEntry(req.params.versionId, req.params.entryId, req.body)); } catch (error) { return next(error); }
  };

  conflicts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.conflicts(req.params.versionId)); } catch (error) { return next(error); }
  };
  analytics = async (req: AuthRequest, res: Response, next: NextFunction) => { try { return ok(res, await timetableService.analytics(req.params.versionId)); } catch (error) { return next(error); } };
  transition = async (req: AuthRequest, res: Response, next: NextFunction) => { try { return ok(res, await timetableService.transition(req.params.versionId, req.body.status)); } catch (error) { return next(error); } };
  clone = async (req: AuthRequest, res: Response, next: NextFunction) => { try { return ok(res, await timetableService.cloneVersion(req.params.versionId, req.user?.userId), 201); } catch (error) { return next(error); } };

  generate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await automaticGeneratorService.generate(req.params.versionId, req.body)); } catch (error) { return next(error); }
  };

  publish = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.publish(req.params.versionId)); } catch (error) { return next(error); }
  };

  deletePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.deletePlan(req.params.planId)); } catch (error) { return next(error); }
  };

  resetVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const clearLocked = req.body?.clearLocked !== false;
      return ok(res, await timetableService.resetVersion(req.params.versionId, clearLocked));
    } catch (error) { return next(error); }
  };

  resetLive = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const academicYear = Number(req.body.academicYear);
      const term = req.body.term;
      return ok(res, await timetableService.resetLiveSchedule(academicYear, term));
    } catch (error) { return next(error); }
  };

  overrideCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.getOverrideCount(req.params.versionId)); } catch (error) { return next(error); }
  };

  gapAnalysis = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.gapAnalysis(req.params.versionId)); } catch (error) { return next(error); }
  };

  deleteBellSchedule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.deleteBellSchedule(req.params.bellScheduleId)); } catch (error) { return next(error); }
  };

  deleteRoom = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.deleteRoom(req.params.roomId)); } catch (error) { return next(error); }
  };

  deleteAllocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.deleteAllocation(req.params.allocationId)); } catch (error) { return next(error); }
  };

  clearAllocations = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const academicYear = req.query.academicYear ? Number(req.query.academicYear) : undefined;
      const grade = req.query.grade ? String(req.query.grade) : undefined;
      return ok(res, await timetableService.clearAllocations({ academicYear, grade }));
    } catch (error) { return next(error); }
  };

  deleteTeacherAvailability = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.deleteTeacherAvailability(req.params.availabilityId)); } catch (error) { return next(error); }
  };

  masterReset = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return ok(res, await timetableService.masterReset(req.body));
    } catch (error) { return next(error); }
  };

  createChangeRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return ok(res, await timetableChangeRequestService.create({ ...req.body, requestedById: req.user!.userId }), 201);
    } catch (error) { return next(error); }
  };

  listChangeRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const canReviewAll = hasPermission(req.user!.role as Role, 'EDIT_TIMETABLE');
      const status = req.query.status ? String(req.query.status) as TimetableChangeRequestStatus : undefined;
      const take = req.query.take ? Number(req.query.take) : undefined;
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
      return ok(res, await timetableChangeRequestService.list({ userId: req.user!.userId, canReviewAll, status, take, cursor }));
    } catch (error) { return next(error); }
  };

  approveChangeRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reviewNote } = req.body || {};
      return ok(res, await timetableChangeRequestService.approve(req.params.requestId, req.user!.userId, reviewNote));
    } catch (error) { return next(error); }
  };

  rejectChangeRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reviewNote } = req.body || {};
      return ok(res, await timetableChangeRequestService.reject(req.params.requestId, req.user!.userId, reviewNote));
    } catch (error) { return next(error); }
  };
}

export const timetableController = new TimetableController();
