import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { timetableService } from './timetable.service';
import { automaticGeneratorService } from './automatic-generator.service';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

export class TimetableController {
  foundation = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.foundation()); } catch (error) { return next(error); }
  };

  createBellSchedule = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.createBellSchedule(req.body), 201); } catch (error) { return next(error); }
  };

  createRoom = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return ok(res, await timetableService.createRoom(req.body), 201); } catch (error) { return next(error); }
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
}

export const timetableController = new TimetableController();
