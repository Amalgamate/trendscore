import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';
import { broadcastKeyDatesChanged } from '../services/keyDates.service';
import {
  AcademicYearPlanInput,
  loadAcademicYear,
  previewAcademicYear,
  saveAcademicYear,
} from '../services/academicYear.service';

/** GET /api/config/academic-year/:year — current setup, to fill the screen. */
export const getAcademicYear = async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.year, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, 'Invalid academic year');
  }
  const data = await loadAcademicYear(year);
  res.json({ success: true, data });
};

/**
 * POST /api/config/academic-year
 * With dryRun: true, returns the checks and the year layout without saving
 * (HTTP 200 even when invalid, so the screen can show every problem at once).
 */
export const saveAcademicYearSetup = async (req: AuthRequest, res: Response) => {
  const { dryRun, ...plan } = req.body as AcademicYearPlanInput & { dryRun?: boolean };

  if (dryRun) {
    const preview = await previewAcademicYear(plan);
    return res.json({ success: true, data: preview });
  }

  const data = await saveAcademicYear(plan, req.user!.userId);
  broadcastKeyDatesChanged();
  res.json({ success: true, data });
};
