/**
 * ChronicAbsentWorker
 *
 * Weekly cron (Monday 07:00 EAT = 04:00 UTC):
 * Identifies learners whose absence rate in the past 4 weeks
 * exceeds the school's configured threshold (default 20%).
 *
 * For each at-risk learner:
 *  1. Creates a PresenceRuleViolation (CHRONIC_ABSENT)
 *  2. Notifies the class teacher (in-app)
 *  3. Notifies the head teacher (in-app)
 *
 * De-duplication: a violation is only created if no unresolved
 * CHRONIC_ABSENT violation already exists for this learner.
 */

import prisma from '../../config/database';
import logger from '../../utils/logger';
import { NotificationService, NotificationType } from '../../services/notification.service';

const RULE_CODE = 'CHRONIC_ABSENT';
const DEFAULT_THRESHOLD_PCT = 20;   // % absence rate to trigger
const LOOKBACK_WEEKS = 4;

export interface ChronicAbsentResult {
  schoolId:      string | null;
  learnersScanned: number;
  atRiskCount:   number;
  notified:      number;
  alreadyFlagged: number;
  skipped:       string[];
}

export async function runChronicAbsentWorker(): Promise<ChronicAbsentResult> {
  logger.info('[ChronicAbsentWorker] Starting');

  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: { id: true, name: true, staffWorkingDays: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!school) {
    logger.warn('[ChronicAbsentWorker] No active school — skipping');
    return { schoolId: null, learnersScanned: 0, atRiskCount: 0, notified: 0, alreadyFlagged: 0, skipped: [] };
  }

  // Get or create the CHRONIC_ABSENT presence rule for this school
  let rule = await prisma.presenceRule.findUnique({
    where: { schoolId_ruleCode: { schoolId: school.id, ruleCode: RULE_CODE } },
  });

  if (!rule) {
    rule = await prisma.presenceRule.create({
      data: {
        schoolId:  school.id,
        ruleCode:  RULE_CODE,
        enabled:   true,
        config:    { thresholdPct: DEFAULT_THRESHOLD_PCT, lookbackWeeks: LOOKBACK_WEEKS },
      },
    });
  }

  if (!rule.enabled) {
    logger.info('[ChronicAbsentWorker] Rule disabled for school — skipping');
    return { schoolId: school.id, learnersScanned: 0, atRiskCount: 0, notified: 0, alreadyFlagged: 0, skipped: [] };
  }

  const config = rule.config as { thresholdPct?: number; lookbackWeeks?: number };
  const thresholdPct   = config.thresholdPct   ?? DEFAULT_THRESHOLD_PCT;
  const lookbackWeeks  = config.lookbackWeeks  ?? LOOKBACK_WEEKS;

  // Date range: past N weeks
  const endDate   = new Date();
  const startDate = new Date(endDate.getTime() - lookbackWeeks * 7 * 24 * 60 * 60 * 1000);
  const utcStart  = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const utcEnd    = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59));

  // Count school days in range (rough: Mon–Fri)
  let totalDays = 0;
  const cursor = new Date(utcStart);
  while (cursor <= utcEnd) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) totalDays++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (totalDays === 0) {
    logger.info('[ChronicAbsentWorker] No school days in range — skipping');
    return { schoolId: school.id, learnersScanned: 0, atRiskCount: 0, notified: 0, alreadyFlagged: 0, skipped: [] };
  }

  // Fetch all active learners
  const learners = await prisma.learner.findMany({
    where: { status: 'ACTIVE', archived: false },
    select: { id: true, firstName: true, lastName: true, grade: true, stream: true },
    orderBy: { grade: 'asc' },
  });

  // Fetch all attendance records in range in one query
  const allAttendance = await prisma.attendance.findMany({
    where: {
      date: { gte: utcStart, lte: utcEnd },
    },
    select: { learnerId: true, status: true },
  });

  // Group by learner
  const attendanceByLearner = new Map<string, { present: number; absent: number }>();
  for (const rec of allAttendance) {
    const entry = attendanceByLearner.get(rec.learnerId) ?? { present: 0, absent: 0 };
    if (rec.status === 'PRESENT' || rec.status === 'LATE') {
      entry.present++;
    } else if (rec.status === 'ABSENT') {
      entry.absent++;
    }
    attendanceByLearner.set(rec.learnerId, entry);
  }

  // Existing unresolved violations for this school (to avoid duplicates)
  const existingViolations = await prisma.presenceRuleViolation.findMany({
    where: { schoolId: school.id, ruleId: rule.id, resolvedAt: null },
    select: { personId: true },
  });
  const alreadyFlaggedSet = new Set(existingViolations.map(v => v.personId));

  let atRiskCount  = 0;
  let notified     = 0;
  let alreadyFlagged = 0;
  const skipped: string[] = [];

  for (const learner of learners) {
    const counts = attendanceByLearner.get(learner.id);
    if (!counts) {
      // No records at all — treat as fully absent if there were school days
      const absenceRate = totalDays > 0 ? 100 : 0;
      if (absenceRate < thresholdPct) continue;
    }

    const marked  = (counts?.present ?? 0) + (counts?.absent ?? 0);
    if (marked < 3) continue; // too few records to make a judgment

    const absenceRate = Math.round(((counts?.absent ?? 0) / marked) * 100);
    if (absenceRate < thresholdPct) continue;

    atRiskCount++;

    // De-duplicate
    if (alreadyFlaggedSet.has(learner.id)) {
      alreadyFlagged++;
      continue;
    }

    // Create violation
    await prisma.presenceRuleViolation.create({
      data: {
        schoolId:    school.id,
        ruleId:      rule.id,
        personId:    learner.id,
        personType:  'LEARNER',
        metadata: {
          absenceRate,
          absenceDays:   counts?.absent ?? 0,
          presentDays:   counts?.present ?? 0,
          totalDaysMarked: marked,
          lookbackWeeks,
          thresholdPct,
        },
      },
    });

    // Find class teacher
    const classRecord = await prisma.class.findFirst({
      where: { grade: learner.grade, ...(learner.stream ? { stream: learner.stream } : {}), active: true, archived: false },
      select: { teacherId: true },
    });

    const recipients: string[] = [];
    if (classRecord?.teacherId) recipients.push(classRecord.teacherId);

    const headTeachers = await prisma.user.findMany({
      where: { OR: [{ role: 'HEAD_TEACHER' }, { role: 'ADMIN' }], archived: false, status: 'ACTIVE' },
      select: { id: true },
    });
    headTeachers.forEach(h => recipients.push(h.id));

    const learnerLabel = `${learner.firstName} ${learner.lastName} (${learner.grade}${learner.stream ? ' ' + learner.stream : ''})`;

    await Promise.all(
      [...new Set(recipients)].map(userId =>
        NotificationService.createNotification({
          userId,
          title:   'Chronic Absenteeism Alert',
          message: `${learnerLabel} has an absence rate of ${absenceRate}% over the past ${lookbackWeeks} weeks. Please follow up.`,
          type:    NotificationType.WARNING,
          link:    `/app/attendance?learnerId=${learner.id}`,
        }).catch(() => {}),
      ),
    );

    notified++;
    logger.info('[ChronicAbsentWorker] Flagged learner', { learnerId: learner.id, absenceRate });
  }

  logger.info(
    `[ChronicAbsentWorker] Complete — scanned=${learners.length}, atRisk=${atRiskCount}, ` +
    `notified=${notified}, alreadyFlagged=${alreadyFlagged}`,
  );

  return {
    schoolId: school.id,
    learnersScanned: learners.length,
    atRiskCount,
    notified,
    alreadyFlagged,
    skipped,
  };
}
