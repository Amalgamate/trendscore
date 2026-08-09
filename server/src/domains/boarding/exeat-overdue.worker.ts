/**
 * ExeatOverdueWorker
 *
 * Daily 06:00 EAT (03:00 UTC): detects learners who were approved for exeat
 * but have not returned by their return date.
 *
 * For each overdue learner (not yet notified):
 *  1. Creates a EXEAT_OVERDUE PresenceRuleViolation
 *  2. Sends SMS to parent
 *  3. Notifies house master and admin via in-app notification
 *  4. Marks overdueNotified=true on the exeat record
 */

import prisma from '../../config/database';
import logger from '../../utils/logger';
import { presenceService } from '../presence/presence.service';
import { NotificationService, NotificationType } from '../../services/notification.service';
import { SmsService } from '../../services/sms.service';

const RULE_CODE = 'EXEAT_OVERDUE';

export async function runExeatOverdueWorker(): Promise<{
  schoolId: string | null; checked: number; overdue: number; notified: number;
}> {
  logger.info('[ExeatOverdueWorker] Starting');

  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!school) {
    logger.warn('[ExeatOverdueWorker] No active school — skipping');
    return { schoolId: null, checked: 0, overdue: 0, notified: 0 };
  }

  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Approved exeats whose return date has passed, departure recorded, return NOT recorded, not yet notified
  const overdueExeats = await prisma.exeatRequest.findMany({
    where: {
      schoolId:        school.id,
      status:          'APPROVED',
      archived:        false,
      returnDate:      { lt: utcToday },
      departedAt:      { not: null },
      returnedAt:      null,
      overdueNotified: false,
    },
  });

  logger.info(`[ExeatOverdueWorker] Found ${overdueExeats.length} overdue exeats`);

  let notified = 0;

  // Get or create presence rule
  let rule = await prisma.presenceRule.findUnique({
    where: { schoolId_ruleCode: { schoolId: school.id, ruleCode: RULE_CODE } },
  });
  if (!rule) {
    rule = await prisma.presenceRule.create({
      data: { schoolId: school.id, ruleCode: RULE_CODE, enabled: true, config: {} },
    });
  }

  for (const exeat of overdueExeats) {
    try {
      const learner = await prisma.learner.findUnique({
        where: { id: exeat.learnerId },
        select: { firstName: true, lastName: true, grade: true },
      });
      if (!learner) continue;

      const learnerLabel = `${learner.firstName} ${learner.lastName} (${learner.grade})`;
      const retDate = exeat.returnDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

      // Create violation record
      await prisma.presenceRuleViolation.create({
        data: {
          schoolId:   school.id,
          ruleId:     rule.id,
          personId:   exeat.learnerId,
          personType: 'LEARNER',
          metadata:   { exeatId: exeat.id, exeatType: exeat.exeatType, returnDate: exeat.returnDate },
        },
      }).catch(() => {}); // ignore duplicate violations

      // Parent SMS
      if (exeat.parentPhone) {
        const msg = `URGENT: ${learnerLabel} was due back at ${school.name} on ${retDate} but has not returned. Please contact the school immediately.`;
        SmsService.sendSms(exeat.parentPhone, msg).catch(() => {});
      }

      // In-app notifications to house master and admin
      const assignment = await prisma.dormitoryAssignment.findFirst({
        where: { learnerId: exeat.learnerId, active: true },
        select: { dormitoryId: true },
      });

      const recipients: string[] = [];
      if (assignment) {
        const hms = await prisma.houseMasterAssignment.findMany({
          where: { dormitoryId: assignment.dormitoryId, active: true },
          select: { userId: true },
        });
        hms.forEach(h => recipients.push(h.userId));
      }
      const admins = await prisma.user.findMany({
        where: { OR: [{ role: 'ADMIN' }, { role: 'HEAD_TEACHER' }], archived: false, status: 'ACTIVE' },
        select: { id: true },
      });
      admins.forEach(a => recipients.push(a.id));

      await Promise.all([...new Set(recipients)].map(userId =>
        NotificationService.createNotification({
          userId,
          title:   '⚠️ Exeat Overdue',
          message: `${learnerLabel} was due to return from ${exeat.exeatType.toLowerCase()} leave on ${retDate} but has not been recorded as returned.`,
          type:    NotificationType.WARNING,
          link:    `/app/boarding/exeat/${exeat.id}`,
        }).catch(() => {}),
      ));

      // Emit presence event
      presenceService.emit({
        schoolId:      school.id,
        personId:      exeat.learnerId,
        personType:    'LEARNER',
        eventType:     'EXEAT_DEPARTED',
        context:       'OFF_CAMPUS',
        timestamp:     exeat.departedAt!,
        status:        'PENDING',
        sourceModule:  'BOARDING',
        sourceRecordId: exeat.id,
        metadata:      { overdueDetected: true, returnDate: exeat.returnDate },
      }).catch(() => {});

      // Mark notified
      await prisma.exeatRequest.update({
        where: { id: exeat.id },
        data:  { overdueNotified: true },
      });

      notified++;
      logger.info('[ExeatOverdueWorker] Notified for overdue exeat', { exeatId: exeat.id, learnerId: exeat.learnerId });

    } catch (err: any) {
      logger.error('[ExeatOverdueWorker] Error processing exeat', { exeatId: exeat.id, error: err.message });
    }
  }

  logger.info(`[ExeatOverdueWorker] Complete — checked=${overdueExeats.length}, notified=${notified}`);
  return { schoolId: school.id, checked: overdueExeats.length, overdue: overdueExeats.length, notified };
}
