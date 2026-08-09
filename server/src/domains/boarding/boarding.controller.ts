/**
 * BoardingController
 *
 * HTTP layer for the boarding module.
 * Thin — delegates all logic to BoardingService.
 * All routes are under /api/v1/boarding/
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/permissions.middleware';
import { ApiError } from '../../utils/error.util';
import * as boarding from './boarding.service';

export class BoardingController {

  // ── Dormitories ────────────────────────────────────────────────────────────

  async createDormitory(req: AuthRequest, res: Response) {
    const dorm = await boarding.createDormitory(req.body);
    res.status(201).json({ success: true, data: dorm, message: 'Dormitory created' });
  }

  async getDormitories(req: AuthRequest, res: Response) {
    const includeArchived = req.query.archived === 'true';
    const dorms = await boarding.getDormitories(includeArchived);
    res.json({ success: true, data: dorms, count: dorms.length });
  }

  async updateDormitory(req: AuthRequest, res: Response) {
    const updated = await boarding.updateDormitory(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  // ── Beds ───────────────────────────────────────────────────────────────────

  async createBed(req: AuthRequest, res: Response) {
    const { dormitoryId } = req.params;
    const { bedNumber, notes } = req.body;
    if (!bedNumber) throw new ApiError(400, 'bedNumber is required');
    const bed = await boarding.createBed(dormitoryId, bedNumber, notes);
    res.status(201).json({ success: true, data: bed });
  }

  async getBeds(req: AuthRequest, res: Response) {
    const beds = await boarding.getBeds(req.params.dormitoryId);
    res.json({ success: true, data: beds, count: beds.length });
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  async assignLearner(req: AuthRequest, res: Response) {
    const { dormitoryId, bedId, learnerId, academicYear, fromDate } = req.body;
    if (!learnerId || !academicYear || !fromDate) throw new ApiError(400, 'learnerId, academicYear, fromDate required');
    const assignment = await boarding.assignLearnerToDorm({
      dormitoryId, bedId, learnerId,
      academicYear: parseInt(academicYear),
      fromDate: new Date(fromDate),
    });
    res.status(201).json({ success: true, data: assignment });
  }

  async getLearnerAssignment(req: AuthRequest, res: Response) {
    const assignment = await boarding.getLearnerDormAssignment(req.params.learnerId);
    res.json({ success: true, data: assignment });
  }

  // ── House Masters ──────────────────────────────────────────────────────────

  async assignHouseMaster(req: AuthRequest, res: Response) {
    const { dormitoryId, userId, role } = req.body;
    if (!dormitoryId || !userId) throw new ApiError(400, 'dormitoryId and userId required');
    const assignment = await boarding.assignHouseMaster(dormitoryId, userId, role || 'DUTY');
    res.status(201).json({ success: true, data: assignment });
  }

  async getHouseMasters(req: AuthRequest, res: Response) {
    const hms = await boarding.getHouseMasters(req.params.dormitoryId);
    res.json({ success: true, data: hms });
  }

  // ── Exeat ──────────────────────────────────────────────────────────────────

  async requestExeat(req: AuthRequest, res: Response) {
    const { learnerId, exeatType, departureDate, returnDate, reason, parentPhone } = req.body;
    if (!learnerId || !departureDate || !returnDate || !reason) {
      throw new ApiError(400, 'learnerId, departureDate, returnDate, reason required');
    }
    const exeat = await boarding.requestExeat({
      learnerId, exeatType: exeatType || 'WEEKEND',
      requestedBy: req.user!.userId,
      departureDate: new Date(departureDate),
      returnDate:    new Date(returnDate),
      reason, parentPhone,
    });
    res.status(201).json({ success: true, data: exeat, message: 'Exeat request submitted' });
  }

  async approveExeat(req: AuthRequest, res: Response) {
    const { approved, denialReason } = req.body;
    const updated = await boarding.approveExeat(
      req.params.exeatId,
      req.user!.userId,
      Boolean(approved),
      denialReason,
    );
    res.json({ success: true, data: updated, message: `Exeat ${approved ? 'approved' : 'denied'}` });
  }

  async recordDeparture(req: AuthRequest, res: Response) {
    const updated = await boarding.recordExeatDeparture(req.params.exeatId);
    res.json({ success: true, data: updated, message: 'Departure recorded' });
  }

  async recordReturn(req: AuthRequest, res: Response) {
    const updated = await boarding.recordExeatReturn(req.params.exeatId);
    res.json({ success: true, data: updated, message: 'Return recorded' });
  }

  async getExeats(req: AuthRequest, res: Response) {
    const { learnerId, status, upcoming } = req.query;
    const exeats = await boarding.getExeatRequests({
      learnerId: learnerId as string | undefined,
      status:    status as any,
      upcoming:  upcoming === 'true',
    });
    res.json({ success: true, data: exeats, count: exeats.length });
  }

  // ── Roll Call ──────────────────────────────────────────────────────────────

  async startRollCall(req: AuthRequest, res: Response) {
    const { dormitoryId, date, session } = req.body;
    if (!dormitoryId || !date || !session) throw new ApiError(400, 'dormitoryId, date, session required');
    const rc = await boarding.startRollCall({
      dormitoryId, date: new Date(date),
      session: session as boarding.RollCallSession,
      conductedBy: req.user!.userId,
    });
    res.status(201).json({ success: true, data: rc });
  }

  async markEntry(req: AuthRequest, res: Response) {
    const { rollCallId } = req.params;
    const { learnerId, status, remarks } = req.body;
    if (!learnerId || !status) throw new ApiError(400, 'learnerId and status required');
    const entry = await boarding.markRollCallEntry({ rollCallId, learnerId, status, remarks });
    res.json({ success: true, data: entry });
  }

  async bulkMarkEntries(req: AuthRequest, res: Response) {
    const { rollCallId } = req.params;
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) throw new ApiError(400, 'entries array required');
    const results = await boarding.bulkMarkRollCall(rollCallId, entries);
    res.json({ success: true, data: results });
  }

  async completeRollCall(req: AuthRequest, res: Response) {
    const updated = await boarding.completeRollCall(req.params.rollCallId);
    res.json({ success: true, data: updated, message: 'Roll call completed' });
  }

  async getRollCall(req: AuthRequest, res: Response) {
    const rc = await boarding.getRollCall(req.params.rollCallId);
    res.json({ success: true, data: rc });
  }

  // ── Dining ─────────────────────────────────────────────────────────────────

  async markDining(req: AuthRequest, res: Response) {
    const { learnerId, date, session, present } = req.body;
    if (!learnerId || !date || !session) throw new ApiError(400, 'learnerId, date, session required');
    const record = await boarding.markDiningAttendance({
      learnerId, date: new Date(date),
      session:    session as boarding.DiningSession,
      present:    present !== false,
      recordedBy: req.user!.userId,
    });
    res.json({ success: true, data: record });
  }

  async bulkMarkDining(req: AuthRequest, res: Response) {
    const { records, date, session } = req.body;
    if (!Array.isArray(records) || !date || !session) throw new ApiError(400, 'records, date, session required');
    const results = await boarding.bulkMarkDining(records, new Date(date), session, req.user!.userId);
    res.json({ success: true, data: results });
  }

  // ── Prep ───────────────────────────────────────────────────────────────────

  async markPrep(req: AuthRequest, res: Response) {
    const { learnerId, date, session, present, remarks } = req.body;
    if (!learnerId || !date || !session) throw new ApiError(400, 'learnerId, date, session required');
    const record = await boarding.markPrepAttendance({
      learnerId, date: new Date(date),
      session:    session as boarding.PrepSession,
      present:    present !== false,
      remarks, recordedBy: req.user!.userId,
    });
    res.json({ success: true, data: record });
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(req: AuthRequest, res: Response) {
    const data = await boarding.getBoardingDashboard();
    res.json({ success: true, data });
  }
}

export const boardingController = new BoardingController();
