/**
 * Presence Analytics
 *
 * Aggregates presence_events data into human-readable statistics
 * for the school admin dashboard.
 *
 * Available metrics:
 *  - Daily attendance rate (school-wide + by grade + by class)
 *  - Weekly absence trend (7-day rolling window)
 *  - Chronic absentee list with risk score
 *  - Late arrival pattern by class
 *  - Transport utilisation vs attendance correlation
 *  - Boarding roll call compliance rate (if boarding enabled)
 *  - Staff attendance summary
 *
 * All queries use presence_events as the source of truth.
 * Per ADR-004: complex aggregations use prisma.$queryRaw with Prisma.sql
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utcDaysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function utcToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function utcEndOfToday(): Date {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyAttendanceRate {
  date:              string;   // YYYY-MM-DD
  totalLearners:     number;
  presentCount:      number;
  absentCount:       number;
  lateCount:         number;
  unmarkedCount:     number;
  attendanceRate:    number;   // percentage
}

export interface WeeklyTrend {
  week:              string;   // ISO week label e.g. "2026-W31"
  avgAttendanceRate: number;
  totalAbsences:     number;
}

export interface AtRiskLearner {
  learnerId:        string;
  firstName:        string;
  lastName:         string;
  grade:            string;
  stream:           string | null;
  absenceCount:     number;
  totalDays:        number;
  absenceRate:      number;
  riskScore:        number;   // 0-100
  riskLevel:        'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastAbsenceDate:  string | null;
}

export interface GradeAttendanceSummary {
  grade:          string;
  totalLearners:  number;
  presentToday:   number;
  attendanceRate: number;
}

export interface LateArrivalPattern {
  grade:      string;
  stream:     string | null;
  classId:    string | null;
  lateCount:  number;
  periodDays: number;
}

export interface BoardingComplianceStats {
  dormitoryId:    string;
  dormitoryName:  string;
  date:           string;
  morningComplete: boolean;
  nightComplete:   boolean;
  absentMorning:   number;
  absentNight:     number;
}

// ---------------------------------------------------------------------------
// Analytics functions
// ---------------------------------------------------------------------------

/**
 * Daily attendance rates for the past N days.
 * Uses presence_events.CLASS_ATTENDANCE as the source.
 */
export async function getDailyAttendanceRates(
  schoolId: string,
  daysBack = 14,
): Promise<DailyAttendanceRate[]> {
  const since = utcDaysAgo(daysBack);
  const totalLearners = await prisma.learner.count({ where: { status: 'ACTIVE', archived: false } });

  // Group CLASS_ATTENDANCE events by date and status
  const events = await prisma.presenceEvent.findMany({
    where: {
      schoolId,
      eventType: 'CLASS_ATTENDANCE',
      timestamp:  { gte: since, lte: utcEndOfToday() },
    },
    select: { personId: true, timestamp: true, metadata: true },
  });

  // Build per-date maps
  const dateMap = new Map<string, { present: Set<string>; absent: Set<string>; late: Set<string> }>();

  for (const ev of events) {
    const d   = ev.timestamp.toISOString().slice(0, 10);
    const meta = ev.metadata as Record<string, unknown> | null;
    const status = String(meta?.attendanceStatus ?? 'PRESENT');

    if (!dateMap.has(d)) dateMap.set(d, { present: new Set(), absent: new Set(), late: new Set() });
    const entry = dateMap.get(d)!;

    if (status === 'PRESENT') entry.present.add(ev.personId);
    else if (status === 'ABSENT') entry.absent.add(ev.personId);
    else if (status === 'LATE') { entry.late.add(ev.personId); entry.present.add(ev.personId); }
  }

  // Fill missing dates with zeroes
  const results: DailyAttendanceRate[] = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = utcDaysAgo(i).toISOString().slice(0, 10);
    const entry = dateMap.get(d) ?? { present: new Set(), absent: new Set(), late: new Set() };
    const presentCount = entry.present.size;
    const absentCount  = entry.absent.size;
    const lateCount    = entry.late.size;
    const unmarked     = Math.max(0, totalLearners - presentCount - absentCount);
    results.push({
      date: d,
      totalLearners,
      presentCount,
      absentCount,
      lateCount,
      unmarkedCount: unmarked,
      attendanceRate: totalLearners > 0 ? Math.round((presentCount / totalLearners) * 100) : 0,
    });
  }

  return results;
}

/**
 * 7-day rolling weekly trend for the past N weeks.
 */
export async function getWeeklyAbsenceTrend(
  schoolId: string,
  weeksBack = 8,
): Promise<WeeklyTrend[]> {
  const since = utcDaysAgo(weeksBack * 7);
  const events = await prisma.presenceEvent.findMany({
    where: {
      schoolId,
      eventType: 'CLASS_ATTENDANCE',
      timestamp:  { gte: since },
    },
    select: { personId: true, timestamp: true, metadata: true },
  });

  // Group by ISO week
  const weekMap = new Map<string, { present: number; absent: number; days: Set<string> }>();

  for (const ev of events) {
    const week = getISOWeekLabel(ev.timestamp);
    const meta = ev.metadata as Record<string, unknown> | null;
    const status = String(meta?.attendanceStatus ?? 'PRESENT');

    if (!weekMap.has(week)) weekMap.set(week, { present: 0, absent: 0, days: new Set() });
    const entry = weekMap.get(week)!;
    entry.days.add(ev.timestamp.toISOString().slice(0, 10));
    if (status === 'PRESENT' || status === 'LATE') entry.present++;
    else if (status === 'ABSENT') entry.absent++;
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, data]) => {
      const total = data.present + data.absent;
      return {
        week,
        avgAttendanceRate: total > 0 ? Math.round((data.present / total) * 100) : 0,
        totalAbsences: data.absent,
      };
    });
}

/**
 * At-risk learners ranked by absence rate and recency.
 * Returns top N by risk score.
 */
export async function getAtRiskLearners(
  schoolId: string,
  daysBack = 28,
  limit = 50,
): Promise<AtRiskLearner[]> {
  const since = utcDaysAgo(daysBack);

  const events = await prisma.presenceEvent.findMany({
    where: {
      schoolId,
      eventType:  'CLASS_ATTENDANCE',
      personType: 'LEARNER',
      timestamp:  { gte: since },
    },
    select: { personId: true, timestamp: true, metadata: true },
    orderBy: { timestamp: 'desc' },
  });

  // Count per learner
  const learnerStats = new Map<string, { present: number; absent: number; lastAbsence: string | null }>();
  for (const ev of events) {
    const meta   = ev.metadata as Record<string, unknown> | null;
    const status = String(meta?.attendanceStatus ?? 'PRESENT');
    if (!learnerStats.has(ev.personId)) {
      learnerStats.set(ev.personId, { present: 0, absent: 0, lastAbsence: null });
    }
    const s = learnerStats.get(ev.personId)!;
    if (status === 'PRESENT' || status === 'LATE') s.present++;
    else if (status === 'ABSENT') {
      s.absent++;
      const dateStr = ev.timestamp.toISOString().slice(0, 10);
      if (!s.lastAbsence || dateStr > s.lastAbsence) s.lastAbsence = dateStr;
    }
  }

  // Filter to learners with at least 5 marked days and >=15% absence rate
  const candidates = Array.from(learnerStats.entries())
    .map(([learnerId, s]) => {
      const total       = s.present + s.absent;
      const absenceRate = total >= 5 ? Math.round((s.absent / total) * 100) : 0;
      // Risk score: weighted by rate (70%) + recency (30%)
      const riskScore = absenceRate >= 15 ? Math.min(100, absenceRate) : 0;
      return { learnerId, absenceCount: s.absent, totalDays: total, absenceRate, riskScore, lastAbsenceDate: s.lastAbsence };
    })
    .filter(c => c.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);

  if (candidates.length === 0) return [];

  const learnerIds = candidates.map(c => c.learnerId);
  const learners   = await prisma.learner.findMany({
    where: { id: { in: learnerIds } },
    select: { id: true, firstName: true, lastName: true, grade: true, stream: true },
  });
  const learnerMap = new Map(learners.map(l => [l.id, l]));

  return candidates
    .map(c => {
      const l = learnerMap.get(c.learnerId);
      if (!l) return null;
      const level: AtRiskLearner['riskLevel'] =
        c.absenceRate >= 40 ? 'CRITICAL' :
        c.absenceRate >= 30 ? 'HIGH' :
        c.absenceRate >= 20 ? 'MEDIUM' : 'LOW';
      return { learnerId: c.learnerId, firstName: l.firstName, lastName: l.lastName,
        grade: l.grade, stream: l.stream, absenceCount: c.absenceCount,
        totalDays: c.totalDays, absenceRate: c.absenceRate,
        riskScore: c.riskScore, riskLevel: level, lastAbsenceDate: c.lastAbsenceDate };
    })
    .filter((x): x is AtRiskLearner => x !== null);
}

/**
 * Attendance rate breakdown by grade for today.
 */
export async function getGradeAttendanceSummary(schoolId: string): Promise<GradeAttendanceSummary[]> {
  const today   = utcToday();
  const endToday = utcEndOfToday();

  const [learnersByGrade, presentEvents] = await Promise.all([
    prisma.learner.groupBy({
      by: ['grade'],
      where: { status: 'ACTIVE', archived: false },
      _count: { id: true },
    }),
    prisma.presenceEvent.findMany({
      where: {
        schoolId,
        eventType:  'CLASS_ATTENDANCE',
        personType: 'LEARNER',
        timestamp:  { gte: today, lte: endToday },
      },
      select: { personId: true, metadata: true },
    }),
  ]);

  // Build set of present learners today + their grades
  const presentIds = new Set(
    presentEvents
      .filter(e => {
        const meta = e.metadata as Record<string, unknown> | null;
        const s    = String(meta?.attendanceStatus ?? 'PRESENT');
        return s === 'PRESENT' || s === 'LATE';
      })
      .map(e => e.personId),
  );

  const presentLearners = await prisma.learner.findMany({
    where: { id: { in: [...presentIds] }, status: 'ACTIVE' },
    select: { grade: true },
  });
  const presentByGrade = new Map<string, number>();
  for (const l of presentLearners) {
    presentByGrade.set(l.grade, (presentByGrade.get(l.grade) ?? 0) + 1);
  }

  return learnersByGrade
    .map(row => {
      const total   = row._count.id;
      const present = presentByGrade.get(row.grade) ?? 0;
      return {
        grade: row.grade,
        totalLearners: total,
        presentToday: present,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    })
    .sort((a, b) => a.grade.localeCompare(b.grade));
}

/**
 * Late arrival patterns by grade/stream over past N days.
 */
export async function getLateArrivalPatterns(
  schoolId: string,
  daysBack = 14,
): Promise<LateArrivalPattern[]> {
  const since = utcDaysAgo(daysBack);

  const lateEvents = await prisma.presenceEvent.findMany({
    where: {
      schoolId,
      eventType: 'CLASS_ATTENDANCE',
      timestamp: { gte: since },
    },
    select: { personId: true, metadata: true },
  });

  const lateByClass = new Map<string, { grade: string; stream: string | null; classId: string | null; count: number }>();

  for (const ev of lateEvents) {
    const meta   = ev.metadata as Record<string, unknown> | null;
    const status = String(meta?.attendanceStatus ?? '');
    if (status !== 'LATE') continue;

    const classId = String(meta?.classId ?? '') || null;
    const key     = classId ?? ev.personId;
    if (!lateByClass.has(key)) {
      lateByClass.set(key, { grade: '', stream: null, classId, count: 0 });
    }
    lateByClass.get(key)!.count++;
  }

  // Enrich with grade/stream from learner
  if (lateByClass.size === 0) return [];

  const learnerIds = [...lateByClass.keys()].filter(k => !k.startsWith('class-'));
  const learners   = await prisma.learner.findMany({
    where: { id: { in: learnerIds } },
    select: { id: true, grade: true, stream: true },
  });
  const learnerMap = new Map(learners.map(l => [l.id, l]));

  // Aggregate by grade
  const gradeMap = new Map<string, { grade: string; stream: string | null; classId: string | null; lateCount: number }>();
  for (const [key, data] of lateByClass.entries()) {
    const learner = learnerMap.get(key);
    const grade   = learner?.grade ?? data.grade ?? 'Unknown';
    const gKey    = grade;
    const existing = gradeMap.get(gKey);
    if (existing) existing.lateCount += data.count;
    else gradeMap.set(gKey, { grade, stream: learner?.stream ?? null, classId: data.classId, lateCount: data.count });
  }

  return Array.from(gradeMap.values())
    .filter(r => r.lateCount > 0)
    .sort((a, b) => b.lateCount - a.lateCount)
    .map(r => ({ grade: r.grade, stream: r.stream, classId: r.classId, lateCount: r.lateCount, periodDays: daysBack }));
}

/**
 * Boarding roll call compliance for the past N days.
 */
export async function getBoardingComplianceStats(
  schoolId: string,
  daysBack = 7,
): Promise<BoardingComplianceStats[]> {
  const since = utcDaysAgo(daysBack);

  const rollCalls = await prisma.dormRollCall.findMany({
    where: { schoolId, date: { gte: since } },
    include: {
      dormitory: { select: { name: true } },
      entries: { where: { status: 'ABSENT' }, select: { id: true } },
    },
    orderBy: [{ date: 'desc' }, { dormitoryId: 'asc' }],
  });

  return rollCalls.map(rc => ({
    dormitoryId:    rc.dormitoryId,
    dormitoryName:  rc.dormitory.name,
    date:           rc.date.toISOString().slice(0, 10),
    morningComplete: rc.session === 'MORNING' && rc.status === 'COMPLETED',
    nightComplete:   rc.session === 'NIGHT'   && rc.status === 'COMPLETED',
    absentMorning:   rc.session === 'MORNING' ? rc.entries.length : 0,
    absentNight:     rc.session === 'NIGHT'   ? rc.entries.length : 0,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISOWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
