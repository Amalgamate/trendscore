/**
 * NEMISService
 *
 * Produces NEMIS-compatible attendance reports from TrendSCORE data.
 *
 * NEMIS (National Education Management Information System) requires:
 *  - Term attendance summary per learner (days present / days school open)
 *  - UPI number as the learner identifier
 *  - Grade / class code
 *  - Reporting period (term + academic year)
 *
 * This service generates the export payload. Actual API submission
 * is deferred until NEMIS API credentials are configured.
 *
 * SECURITY: upiNumber is sensitive — not exposed in bulk API responses.
 * The generated report is available only to SUPER_ADMIN and ADMIN roles.
 */

import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NEMISAttendanceRecord {
  upiNumber:       string;
  admissionNumber: string;
  firstName:       string;
  lastName:        string;
  grade:           string;
  gender:          string;
  daysPresent:     number;
  daysAbsent:      number;
  daysLate:        number;
  totalDaysMarked: number;
  attendanceRate:  number;
  term:            string;
  academicYear:    number;
}

export interface NEMISExportResult {
  schoolName:     string;
  term:           string;
  academicYear:   number;
  generatedAt:    string;
  totalLearners:  number;
  records:        NEMISAttendanceRecord[];
  summary: {
    avgAttendanceRate: number;
    learnersWithNoRecords: number;
    learnersWithUpi: number;
    learnersWithoutUpi: number;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class NEMISService {

  /**
   * Generate a NEMIS attendance report for a given term.
   * Only returns learners who have at least one attendance record.
   */
  async generateTermAttendanceReport(
    term: string,
    academicYear: number,
  ): Promise<NEMISExportResult> {
    logger.info('[NEMISService] Generating attendance report', { term, academicYear });

    const school = await prisma.school.findFirst({
      where: { archived: false, active: true },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!school) throw new ApiError(500, 'No active school found');

    // Parse term to date range
    const dateRange = this.termToDateRange(term, academicYear);

    // Fetch all active learners with UPI numbers
    const learners = await prisma.learner.findMany({
      where: { status: 'ACTIVE', archived: false },
      select: {
        id: true,
        upiNumber: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        grade: true,
        gender: true,
      },
      orderBy: [{ grade: 'asc' }, { lastName: 'asc' }],
    });

    // Fetch all attendance records in the term range
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        archived: false,
      },
      select: {
        learnerId: true,
        status:    true,
      },
    });

    // Group by learnerId
    const attendanceMap = new Map<string, { present: number; absent: number; late: number; excused: number; sick: number }>();
    for (const rec of attendanceRecords) {
      if (!attendanceMap.has(rec.learnerId)) {
        attendanceMap.set(rec.learnerId, { present: 0, absent: 0, late: 0, excused: 0, sick: 0 });
      }
      const entry = attendanceMap.get(rec.learnerId)!;
      switch (rec.status) {
        case 'PRESENT':  entry.present++;  break;
        case 'ABSENT':   entry.absent++;   break;
        case 'LATE':     entry.late++;     break;
        case 'EXCUSED':  entry.excused++;  break;
        case 'SICK':     entry.sick++;     break;
      }
    }

    let learnersWithUpi     = 0;
    let learnersWithoutUpi  = 0;
    let learnersWithNoRecs  = 0;
    let totalAttendanceRate = 0;
    let ratedCount          = 0;

    const records: NEMISAttendanceRecord[] = [];

    for (const learner of learners) {
      if (learner.upiNumber) learnersWithUpi++;
      else learnersWithoutUpi++;

      const stats = attendanceMap.get(learner.id);
      if (!stats) { learnersWithNoRecs++; continue; }

      const daysPresent     = stats.present + stats.late; // LATE = physically present
      const daysAbsent      = stats.absent;
      const daysLate        = stats.late;
      const totalDaysMarked = stats.present + stats.absent + stats.late + stats.excused + stats.sick;
      const attendanceRate  = totalDaysMarked > 0
        ? Math.round((daysPresent / totalDaysMarked) * 100)
        : 0;

      totalAttendanceRate += attendanceRate;
      ratedCount++;

      records.push({
        upiNumber:       learner.upiNumber ?? 'NOT_ASSIGNED',
        admissionNumber: learner.admissionNumber,
        firstName:       learner.firstName,
        lastName:        learner.lastName,
        grade:           learner.grade,
        gender:          learner.gender,
        daysPresent,
        daysAbsent,
        daysLate,
        totalDaysMarked,
        attendanceRate,
        term,
        academicYear,
      });
    }

    const avgAttendanceRate = ratedCount > 0
      ? Math.round(totalAttendanceRate / ratedCount)
      : 0;

    logger.info('[NEMISService] Report generated', {
      totalLearners: learners.length,
      recordsIncluded: records.length,
      avgAttendanceRate,
    });

    return {
      schoolName:    school.name,
      term,
      academicYear,
      generatedAt:   new Date().toISOString(),
      totalLearners: learners.length,
      records,
      summary: {
        avgAttendanceRate,
        learnersWithNoRecords: learnersWithNoRecs,
        learnersWithUpi,
        learnersWithoutUpi,
      },
    };
  }

  /**
   * Convert term string to approximate date range.
   * Kenya standard: 3 terms per year, roughly 13 weeks each.
   */
  private termToDateRange(term: string, academicYear: number): { start: Date; end: Date } {
    const termMap: Record<string, { startMonth: number; startDay: number; endMonth: number; endDay: number }> = {
      'TERM_1': { startMonth: 1, startDay: 10, endMonth: 4,  endDay: 5  },
      'TERM_2': { startMonth: 5, startDay: 2,  endMonth: 8,  endDay: 2  },
      'TERM_3': { startMonth: 9, startDay: 4,  endMonth: 11, endDay: 20 },
    };

    const config = termMap[term] ?? termMap['TERM_1'];
    return {
      start: new Date(Date.UTC(academicYear, config.startMonth - 1, config.startDay)),
      end:   new Date(Date.UTC(academicYear, config.endMonth   - 1, config.endDay, 23, 59, 59)),
    };
  }
}

export const nemisService = new NEMISService();
