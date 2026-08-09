/**
 * AnalyticsController
 *
 * Exposes all Phase 6 analytics and intelligence endpoints.
 * All routes under /api/v1/analytics/
 *
 * Access: VIEW_PRESENCE_ANALYTICS (ADMIN, HEAD_TEACHER, SUPER_ADMIN)
 * NEMIS export: SUPER_ADMIN and ADMIN only.
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/permissions.middleware';
import { ApiError } from '../../utils/error.util';
import {
  getDailyAttendanceRates,
  getWeeklyAbsenceTrend,
  getAtRiskLearners,
  getGradeAttendanceSummary,
  getLateArrivalPatterns,
  getBoardingComplianceStats,
} from './presence.analytics';
import { earlyWarningService } from './early-warning.service';
import { nemisService } from './nemis.service';
import prisma from '../../config/database';

// ---------------------------------------------------------------------------
// School ID resolver
// ---------------------------------------------------------------------------

async function resolveSchoolId(): Promise<string> {
  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!school) throw new ApiError(500, 'No active school found');
  return school.id;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class AnalyticsController {

  /**
   * GET /api/v1/analytics/attendance/daily
   * Daily attendance rates for the past N days (default 14).
   */
  async getDailyRates(req: AuthRequest, res: Response) {
    const daysBack = parseInt(req.query.daysBack as string) || 14;
    if (daysBack > 90) throw new ApiError(400, 'daysBack cannot exceed 90');
    const schoolId = await resolveSchoolId();
    const data = await getDailyAttendanceRates(schoolId, daysBack);
    res.json({ success: true, data, count: data.length });
  }

  /**
   * GET /api/v1/analytics/attendance/weekly
   * Weekly absence trend for the past N weeks (default 8).
   */
  async getWeeklyTrend(req: AuthRequest, res: Response) {
    const weeksBack = parseInt(req.query.weeksBack as string) || 8;
    if (weeksBack > 52) throw new ApiError(400, 'weeksBack cannot exceed 52');
    const schoolId = await resolveSchoolId();
    const data = await getWeeklyAbsenceTrend(schoolId, weeksBack);
    res.json({ success: true, data, count: data.length });
  }

  /**
   * GET /api/v1/analytics/attendance/by-grade
   * Today's attendance rate broken down by grade.
   */
  async getByGrade(req: AuthRequest, res: Response) {
    const schoolId = await resolveSchoolId();
    const data = await getGradeAttendanceSummary(schoolId);
    res.json({ success: true, data, count: data.length });
  }

  /**
   * GET /api/v1/analytics/at-risk
   * At-risk learners ranked by absence rate and risk score.
   * ?daysBack=28&limit=50
   */
  async getAtRisk(req: AuthRequest, res: Response) {
    const daysBack = parseInt(req.query.daysBack as string) || 28;
    const limit    = parseInt(req.query.limit as string)    || 50;
    if (daysBack > 90)  throw new ApiError(400, 'daysBack cannot exceed 90');
    if (limit > 200)    throw new ApiError(400, 'limit cannot exceed 200');
    const schoolId = await resolveSchoolId();
    const data = await getAtRiskLearners(schoolId, daysBack, limit);
    res.json({
      success: true,
      data,
      count: data.length,
      summary: {
        critical: data.filter(l => l.riskLevel === 'CRITICAL').length,
        high:     data.filter(l => l.riskLevel === 'HIGH').length,
        medium:   data.filter(l => l.riskLevel === 'MEDIUM').length,
        low:      data.filter(l => l.riskLevel === 'LOW').length,
      },
    });
  }

  /**
   * GET /api/v1/analytics/late-patterns
   * Late arrival patterns by grade over past N days.
   */
  async getLatePatterns(req: AuthRequest, res: Response) {
    const daysBack = parseInt(req.query.daysBack as string) || 14;
    const schoolId = await resolveSchoolId();
    const data = await getLateArrivalPatterns(schoolId, daysBack);
    res.json({ success: true, data, count: data.length });
  }

  /**
   * GET /api/v1/analytics/boarding/compliance
   * Boarding roll call compliance for the past N days.
   */
  async getBoardingCompliance(req: AuthRequest, res: Response) {
    const daysBack = parseInt(req.query.daysBack as string) || 7;
    const schoolId = await resolveSchoolId();
    const data = await getBoardingComplianceStats(schoolId, daysBack);
    res.json({ success: true, data, count: data.length });
  }

  /**
   * POST /api/v1/analytics/early-warning/run
   * Trigger all early-warning checks manually (admin only).
   * Normally runs via nightly cron.
   */
  async runEarlyWarning(req: AuthRequest, res: Response) {
    const schoolId = await resolveSchoolId();
    const result = await earlyWarningService.runAllChecks(schoolId);
    res.json({
      success: true,
      data:    result,
      message: `Early warning checks complete — ${result.total} new violations detected`,
    });
  }

  /**
   * GET /api/v1/analytics/early-warning/violations
   * List current unresolved early warning violations.
   */
  async getViolations(req: AuthRequest, res: Response) {
    const schoolId = await resolveSchoolId();
    const violations = await prisma.presenceRuleViolation.findMany({
      where: { schoolId, resolvedAt: null },
      include: { rule: { select: { ruleCode: true } } },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: violations, count: violations.length });
  }

  /**
   * POST /api/v1/analytics/early-warning/violations/:id/resolve
   * Mark a violation as resolved.
   */
  async resolveViolation(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { resolution } = req.body;
    const violation = await prisma.presenceRuleViolation.findUnique({ where: { id } });
    if (!violation) throw new ApiError(404, 'Violation not found');
    const updated = await prisma.presenceRuleViolation.update({
      where: { id },
      data:  { resolvedAt: new Date(), resolution: resolution ?? 'Resolved by admin' },
    });
    res.json({ success: true, data: updated });
  }

  /**
   * GET /api/v1/analytics/nemis/report?term=TERM_1&academicYear=2026
   * Generate NEMIS attendance export for a term.
   * Access: SUPER_ADMIN and ADMIN only.
   */
  async getNEMISReport(req: AuthRequest, res: Response) {
    const { term, academicYear } = req.query;
    if (!term || !academicYear) {
      throw new ApiError(400, 'term and academicYear are required');
    }
    const year   = parseInt(academicYear as string, 10);
    if (isNaN(year)) throw new ApiError(400, 'academicYear must be a valid integer');

    const report = await nemisService.generateTermAttendanceReport(term as string, year);
    res.json({ success: true, data: report });
  }

  /**
   * GET /api/v1/analytics/school/overview
   * Combined school analytics snapshot (for the main dashboard widget).
   */
  async getSchoolOverview(req: AuthRequest, res: Response) {
    const schoolId = await resolveSchoolId();

    const [
      dailyRates,
      atRisk,
      gradeBreakdown,
      violations,
    ] = await Promise.all([
      getDailyAttendanceRates(schoolId, 7),
      getAtRiskLearners(schoolId, 28, 10),
      getGradeAttendanceSummary(schoolId),
      prisma.presenceRuleViolation.count({ where: { schoolId, resolvedAt: null } }),
    ]);

    const today = dailyRates[dailyRates.length - 1];

    res.json({
      success: true,
      data: {
        today: {
          attendanceRate: today?.attendanceRate ?? 0,
          presentCount:   today?.presentCount   ?? 0,
          absentCount:    today?.absentCount    ?? 0,
          unmarkedCount:  today?.unmarkedCount  ?? 0,
          totalLearners:  today?.totalLearners  ?? 0,
        },
        trend:           dailyRates.map(d => ({ date: d.date, rate: d.attendanceRate })),
        gradeBreakdown,
        atRiskCount:     atRisk.length,
        criticalCount:   atRisk.filter(l => l.riskLevel === 'CRITICAL').length,
        openViolations:  violations,
      },
    });
  }
}

export const analyticsController = new AnalyticsController();
