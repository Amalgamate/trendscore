/**
 * EarlyWarningService
 *
 * Identifies at-risk learners using multiple signals from presence data.
 * Produces structured alerts for the admin dashboard and auto-creates
 * PresenceRuleViolations for persistent patterns.
 *
 * Signals monitored:
 *  1. CHRONIC_ABSENT    — absence rate > threshold over rolling 4 weeks
 *  2. LATE_PATTERN      — LATE on 3+ days in rolling 5-day window
 *  3. DORM_ABSCOND      — CLASS_ATTENDANCE present but night DORM_ROLL_CALL absent
 *  4. BUS_NO_ARRIVAL    — BUS_BOARDED but no CLASS_ATTENDANCE within 90 min
 *
 * This service reads from presence_events and creates PresenceRuleViolations.
 * It does NOT send notifications directly — that is the PresenceNotificationRouter's job.
 * For now notifications are triggered inline (full router is Phase 7+).
 */

import prisma from '../../config/database';
import { getAtRiskLearners } from './presence.analytics';
import logger from '../../utils/logger';
import { NotificationService, NotificationType } from '../../services/notification.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarningType = 'CHRONIC_ABSENT' | 'LATE_PATTERN' | 'DORM_ABSCOND' | 'BUS_NO_ARRIVAL';

export interface EarlyWarning {
  learnerId:   string;
  learnerName: string;
  grade:       string;
  warningType: WarningType;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detail:      string;
  detectedAt:  Date;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------

export class EarlyWarningService {

  /**
   * Run all early-warning checks for the school.
   * Called by the analytics nightly cron (23:00 UTC).
   */
  async runAllChecks(schoolId: string): Promise<{
    chronicallyAbsent: number;
    latePatterns: number;
    dormAbscond: number;
    busNoArrival: number;
    total: number;
  }> {
    logger.info('[EarlyWarningService] Starting checks', { schoolId });

    const [chronic, late, dorm, bus] = await Promise.all([
      this.checkChronicAbsence(schoolId).catch(err => { logger.error('[EarlyWarning] chronic check failed', err); return 0; }),
      this.checkLatePattern(schoolId).catch(err => { logger.error('[EarlyWarning] late check failed', err); return 0; }),
      this.checkDormAbscond(schoolId).catch(err => { logger.error('[EarlyWarning] dorm check failed', err); return 0; }),
      this.checkBusNoArrival(schoolId).catch(err => { logger.error('[EarlyWarning] bus check failed', err); return 0; }),
    ]);

    logger.info('[EarlyWarningService] Checks complete', { chronic, late, dorm, bus });
    return { chronicallyAbsent: chronic, latePatterns: late, dormAbscond: dorm, busNoArrival: bus, total: chronic + late + dorm + bus };
  }

  // ── Signal 1: Chronic absence ────────────────────────────────────────────

  private async checkChronicAbsence(schoolId: string): Promise<number> {
    const rule = await this.ensureRule(schoolId, 'CHRONIC_ABSENT');
    if (!rule.enabled) return 0;

    const atRisk = await getAtRiskLearners(schoolId, 28, 100);
    const high   = atRisk.filter(l => l.riskLevel === 'HIGH' || l.riskLevel === 'CRITICAL');

    const existing = await prisma.presenceRuleViolation.findMany({
      where: { schoolId, ruleId: rule.id, resolvedAt: null },
      select: { personId: true },
    });
    const alreadyFlagged = new Set(existing.map(e => e.personId));

    let newViolations = 0;
    for (const learner of high) {
      if (alreadyFlagged.has(learner.learnerId)) continue;
      await prisma.presenceRuleViolation.create({
        data: {
          schoolId,
          ruleId:     rule.id,
          personId:   learner.learnerId,
          personType: 'LEARNER',
          metadata:   { absenceRate: learner.absenceRate, riskLevel: learner.riskLevel, absenceCount: learner.absenceCount },
        },
      }).catch(() => {});
      await this.notifyClassTeacher(learner.learnerId, schoolId,
        `⚠️ ${learner.firstName} ${learner.lastName} (${learner.grade}) has a ${learner.absenceRate}% absence rate over the past 4 weeks.`);
      newViolations++;
    }
    return newViolations;
  }

  // ── Signal 2: Late pattern ────────────────────────────────────────────────

  private async checkLatePattern(schoolId: string): Promise<number> {
    const rule = await this.ensureRule(schoolId, 'LATE_PATTERN');
    if (!rule.enabled) return 0;

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    fiveDaysAgo.setUTCHours(0, 0, 0, 0);

    const lateEvents = await prisma.presenceEvent.findMany({
      where: {
        schoolId, eventType: 'CLASS_ATTENDANCE',
        personType: 'LEARNER',
        timestamp: { gte: fiveDaysAgo },
      },
      select: { personId: true, timestamp: true, metadata: true },
    });

    // Count LATE per learner in last 5 days
    const lateByLearner = new Map<string, number>();
    for (const ev of lateEvents) {
      const meta   = ev.metadata as Record<string, unknown> | null;
      const status = String(meta?.attendanceStatus ?? '');
      if (status !== 'LATE') continue;
      lateByLearner.set(ev.personId, (lateByLearner.get(ev.personId) ?? 0) + 1);
    }

    const threshold = 3;
    const flagged   = Array.from(lateByLearner.entries()).filter(([, count]) => count >= threshold);

    const existing = await prisma.presenceRuleViolation.findMany({
      where: { schoolId, ruleId: rule.id, resolvedAt: null },
      select: { personId: true },
    });
    const alreadyFlagged = new Set(existing.map(e => e.personId));

    let newViolations = 0;
    for (const [learnerId, lateCount] of flagged) {
      if (alreadyFlagged.has(learnerId)) continue;
      await prisma.presenceRuleViolation.create({
        data: { schoolId, ruleId: rule.id, personId: learnerId, personType: 'LEARNER', metadata: { lateCount, periodDays: 5 } },
      }).catch(() => {});
      await this.notifyClassTeacher(learnerId, schoolId,
        `⏰ A learner has been late ${lateCount} times in the past 5 school days. Follow up recommended.`);
      newViolations++;
    }
    return newViolations;
  }

  // ── Signal 3: Dorm abscond ────────────────────────────────────────────────

  private async checkDormAbscond(schoolId: string): Promise<number> {
    const rule = await this.ensureRule(schoolId, 'DORM_ABSCOND');
    if (!rule.enabled) return 0;

    const today       = new Date(); today.setUTCHours(0,0,0,0);
    const endOfDay    = new Date(); endOfDay.setUTCHours(23,59,59,999);

    // Learners present in class today
    const classPresent = await prisma.presenceEvent.findMany({
      where: { schoolId, eventType: 'CLASS_ATTENDANCE', personType: 'LEARNER', timestamp: { gte: today, lte: endOfDay } },
      select: { personId: true },
    });
    const presentIds = new Set(classPresent.map(e => e.personId));
    if (presentIds.size === 0) return 0;

    // Learners absent from night roll call tonight
    const nightAbsent = await prisma.dormRollCallEntry.findMany({
      where: {
        status: 'ABSENT',
        rollCall: { schoolId, date: today, session: 'NIGHT', status: 'COMPLETED' },
        learnerId: { in: [...presentIds] },
      },
      select: { learnerId: true, rollCallId: true },
    });

    const existing = await prisma.presenceRuleViolation.findMany({
      where: { schoolId, ruleId: rule.id, resolvedAt: null },
      select: { personId: true },
    });
    const alreadyFlagged = new Set(existing.map(e => e.personId));

    let newViolations = 0;
    for (const entry of nightAbsent) {
      if (alreadyFlagged.has(entry.learnerId)) continue;
      await prisma.presenceRuleViolation.create({
        data: { schoolId, ruleId: rule.id, personId: entry.learnerId, personType: 'LEARNER', metadata: { rollCallId: entry.rollCallId, detectedAt: new Date() } },
      }).catch(() => {});
      newViolations++;
    }
    return newViolations;
  }

  // ── Signal 4: Bus no arrival ──────────────────────────────────────────────

  private async checkBusNoArrival(schoolId: string): Promise<number> {
    const rule = await this.ensureRule(schoolId, 'BUS_NO_ARRIVAL');
    if (!rule.enabled) return 0;

    const today    = new Date(); today.setUTCHours(0,0,0,0);
    const endOfDay = new Date(); endOfDay.setUTCHours(23,59,59,999);
    const window   = 90 * 60 * 1000; // 90 minutes in ms

    // Learners who boarded a bus this morning
    const boardedEvents = await prisma.presenceEvent.findMany({
      where: {
        schoolId, eventType: 'BUS_BOARDED', personType: 'LEARNER',
        timestamp: { gte: today, lte: endOfDay },
      },
      select: { personId: true, timestamp: true },
    });

    if (boardedEvents.length === 0) return 0;

    // For each boarder, check if CLASS_ATTENDANCE within 90 min
    const classAttendance = await prisma.presenceEvent.findMany({
      where: {
        schoolId, eventType: 'CLASS_ATTENDANCE', personType: 'LEARNER',
        personId: { in: boardedEvents.map(e => e.personId) },
        timestamp: { gte: today, lte: endOfDay },
      },
      select: { personId: true, timestamp: true },
    });
    const classAttendanceMap = new Map<string, Date>();
    for (const ev of classAttendance) {
      const existing = classAttendanceMap.get(ev.personId);
      if (!existing || ev.timestamp < existing) classAttendanceMap.set(ev.personId, ev.timestamp);
    }

    const existing = await prisma.presenceRuleViolation.findMany({
      where: { schoolId, ruleId: rule.id, resolvedAt: null },
      select: { personId: true },
    });
    const alreadyFlagged = new Set(existing.map(e => e.personId));

    let newViolations = 0;
    for (const boarding of boardedEvents) {
      if (alreadyFlagged.has(boarding.personId)) continue;
      const classTime = classAttendanceMap.get(boarding.personId);
      const elapsed   = classTime
        ? classTime.getTime() - boarding.timestamp.getTime()
        : Date.now() - boarding.timestamp.getTime();

      if (elapsed > window && !classTime) {
        await prisma.presenceRuleViolation.create({
          data: { schoolId, ruleId: rule.id, personId: boarding.personId, personType: 'LEARNER',
            metadata: { boardedAt: boarding.timestamp, windowMinutes: 90 } },
        }).catch(() => {});
        await this.notifyClassTeacher(boarding.personId, schoolId,
          `🚌 A learner boarded the school bus but has not been marked present in class after 90 minutes.`);
        newViolations++;
      }
    }
    return newViolations;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async ensureRule(schoolId: string, ruleCode: WarningType) {
    let rule = await prisma.presenceRule.findUnique({
      where: { schoolId_ruleCode: { schoolId, ruleCode } },
    });
    if (!rule) {
      rule = await prisma.presenceRule.create({
        data: { schoolId, ruleCode, enabled: true, config: {} },
      });
    }
    return rule;
  }

  private async notifyClassTeacher(learnerId: string, schoolId: string, message: string): Promise<void> {
    try {
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { grade: true, stream: true },
      });
      if (!learner) return;

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

      await Promise.all([...new Set(recipients)].map(userId =>
        NotificationService.createNotification({
          userId, title: 'Early Warning Alert', message, type: NotificationType.WARNING,
          link: `/app/attendance?learnerId=${learnerId}`,
        }).catch(() => {}),
      ));
    } catch (err: any) {
      logger.warn('[EarlyWarning] Notification failed', { error: err.message });
    }
  }
}

export const earlyWarningService = new EarlyWarningService();
