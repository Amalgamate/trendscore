import { Response } from 'express';
import { DutyRosterFrequency } from '@prisma/client';
import { AuthRequest } from '../middleware/permissions.middleware';
import { DutyRosterService } from '../services/dutyRoster.service';
import { getCanonicalRoles } from '../utils/roleNormalizer';

export class DutyRosterController {
  async list(req: AuthRequest, res: Response) {
    const rosters = await DutyRosterService.listRosters();
    res.json({ success: true, data: rosters });
  }

  async listTeachers(req: AuthRequest, res: Response) {
    const teachers = await DutyRosterService.getTeachersForDuty();
    res.json({ success: true, data: teachers });
  }

  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { title, frequency, startDate, endDate, isActive, reminderEnabled, assignments } = req.body;
    const roster = await DutyRosterService.createRoster({
      title,
      frequency: frequency as DutyRosterFrequency,
      startDate,
      endDate,
      isActive,
      reminderEnabled,
      assignments,
      createdById: userId
    });
    res.status(201).json({ success: true, data: roster });
  }

  async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.userId;
    const roles = getCanonicalRoles(req.user);
    const { title, frequency, startDate, endDate, isActive, reminderEnabled, assignments } = req.body;
    const roster = await DutyRosterService.updateRoster(id, {
      title,
      frequency: frequency as DutyRosterFrequency,
      startDate,
      endDate,
      isActive,
      reminderEnabled,
      assignments
    }, { userId, canManageAll: roles.some((role) => ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(role)) });
    res.json({ success: true, data: roster });
  }

  async remove(req: AuthRequest, res: Response) {
    const { id } = req.params;
    await DutyRosterService.deleteRoster(id);
    res.json({ success: true, message: 'Duty roster deleted successfully' });
  }
}
