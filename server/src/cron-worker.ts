/**
 * TrendScore Background Cron Worker
 * Dedicated process for handling scheduled tasks and background jobs.
 */

import 'dotenv/config';
import cron from 'node-cron';
import prisma from './config/database';
import { pledgeReminderService } from './services/pledgeReminder.service';
import { libraryAutomationService } from './services/libraryAutomation.service';
import messageService from './services/message.service';
import logger from './utils/logger';
import { DutyRosterService } from './services/dutyRoster.service';
import { approvalEngineService } from './services/approvalEngine.service';
import { LMSNotificationService } from './services/lms-notification.service';
import { runAbsentLearnerSmsWorker } from './domains/attendance/absent-learner.worker';
import { runSmsRetryWorker } from './domains/communication/sms-retry.worker';
import { runChronicAbsentWorker } from './domains/attendance/chronic-absent.worker';
import { runBiometricSyncWorker } from './domains/biometrics/biometric-sync.worker';
import { runBiometricLogRetryWorker } from './domains/biometrics/biometric-log-retry.worker';
import { runExeatOverdueWorker } from './domains/boarding/exeat-overdue.worker';
import { earlyWarningService } from './domains/presence/early-warning.service';

/**
 * Query all PUBLISHED assignments whose dueDate falls on tomorrow (in UTC),
 * find enrolled learners who have not yet submitted, and dispatch the
 * due-tomorrow notification to each of them.
 *
 * Requirements: 3.11, 19.7
 */
async function sendAssignmentDueTomorrowReminders(): Promise<void> {
    // Build tomorrow's date range in UTC (midnight-to-midnight)
    const now = new Date();
    const tomorrowStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0,
    ));
    const tomorrowEnd = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        23, 59, 59, 999,
    ));

    // Fetch all PUBLISHED assignments due tomorrow
    const assignments = await prisma.learningAssignment.findMany({
        where: {
            status: 'PUBLISHED',
            dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
            archived: false,
        },
    });

    if (assignments.length === 0) {
        logger.info('[CRON] No assignments due tomorrow — skipping reminders');
        return;
    }

    logger.info(`[CRON] Found ${assignments.length} assignment(s) due tomorrow`);

    for (const assignment of assignments) {
        try {
            // Fetch learner IDs enrolled in the assignment's class
            const enrollments = await prisma.classEnrollment.findMany({
                where: { classId: assignment.classId, active: true, archived: false },
                select: { learnerId: true },
            });

            if (enrollments.length === 0) continue;

            const allLearnerIds = enrollments.map((e) => e.learnerId);

            // Find learners whose work is currently with the teacher or fully
            // marked. RETURNED work is deliberately excluded so the learner
            // still receives a due reminder while corrections are outstanding.
            const submissions = await prisma.learningSubmission.findMany({
                where: {
                    assignmentId: assignment.id,
                    learnerId: { in: allLearnerIds },
                    status: { in: ['SUBMITTED', 'LATE', 'MARKED', 'RESUBMITTED'] },
                    archived: false,
                },
                select: { learnerId: true },
            });

            const submittedLearnerIds = new Set(submissions.map((s) => s.learnerId));

            // Only remind learners who have NOT yet submitted
            const pendingLearnerIds = allLearnerIds.filter(
                (id) => !submittedLearnerIds.has(id),
            );

            if (pendingLearnerIds.length === 0) {
                logger.info(`[CRON] All students already submitted for assignment ${assignment.id} — skipping`);
                continue;
            }

            // Resolve learner IDs → student user IDs
            const learners = await prisma.learner.findMany({
                where: { id: { in: pendingLearnerIds }, archived: false },
                select: { admissionNumber: true },
            });

            const usernameCandidates = learners.flatMap((l) => [
                l.admissionNumber,
                l.admissionNumber.replace(/\//g, '-'),
            ]);

            const studentUsers = await prisma.user.findMany({
                where: {
                    username: { in: usernameCandidates },
                    role: 'STUDENT',
                    archived: false,
                    status: 'ACTIVE',
                },
                select: { id: true },
            });

            const learnerUserIds = studentUsers.map((u) => u.id);

            if (learnerUserIds.length === 0) continue;

            await LMSNotificationService.onAssignmentDueTomorrow(assignment, learnerUserIds);

            logger.info(
                `[CRON] Due-tomorrow reminder sent for assignment "${assignment.title}" to ${learnerUserIds.length} student(s)`,
            );
        } catch (err: any) {
            logger.error(
                `[CRON] Failed to process due-tomorrow reminders for assignment ${assignment.id}:`,
                err?.message ?? err,
            );
        }
    }
}

async function startCronWorker() {
    try {
        await prisma.$connect();
        logger.info('✅ Cron worker connected to database');

        // Start the internal message scheduler
        messageService.startScheduler();

        // ── Pledge Reminders ──────────────────────────────────────────────────
        // Daily at 8:00 AM EAT (05:00 UTC)
        cron.schedule('0 5 * * *', () => {
            logger.info('[CRON] Running daily pledge reminders check');
            pledgeReminderService.runDailyCheck().catch(err => {
                logger.error('[CRON] Pledge reminder error:', err);
            });
        });

        // ── Library Automation ────────────────────────────────────────────────
        
        // 1. Auto-assess late fines: 00:05 EAT (21:05 UTC prev day)
        cron.schedule('5 21 * * *', () => {
            logger.info('[CRON] Running library late fine assessment');
            libraryAutomationService.autoAssessLateFines().catch(err => {
                logger.error('[CRON] Library fine assessment error:', err);
            });
        });

        // 2. Send overdue SMS reminders: 08:00 EAT (05:00 UTC)
        cron.schedule('0 5 * * *', () => {
            logger.info('[CRON] Sending library overdue SMS reminders');
            libraryAutomationService.sendOverdueSmsBatch().catch(err => {
                logger.error('[CRON] Library SMS reminder error:', err);
            });
        });

        // 3. Auto-suspend members with large unpaid fines: 00:10 EAT
        cron.schedule('10 21 * * *', () => {
            logger.info('[CRON] Running library member suspension check');
            libraryAutomationService.autoSuspendMembersWithFines().catch(err => {
                logger.error('[CRON] Library member suspension error:', err);
            });
        });

        // 4. Auto-expire memberships: 00:15 EAT
        cron.schedule('15 21 * * *', () => {
            logger.info('[CRON] Running library membership expiration check');
            libraryAutomationService.autoExpireMemberships().catch(err => {
                logger.error('[CRON] Library membership expiration error:', err);
            });
        });

        // ── Duty Roster Notifications ────────────────────────────────────────
        // 1. Tomorrow reminder: 8:00 PM EAT (17:00 UTC)
        cron.schedule('0 17 * * *', () => {
            logger.info('[CRON] Sending duty reminders for tomorrow');
            DutyRosterService.sendDailyPreviousDayReminders().catch(err => {
                logger.error('[CRON] Duty tomorrow reminder error:', err);
            });
        });

        // 2. Same-day reminder: 6:00 AM EAT (03:00 UTC)
        cron.schedule('0 3 * * *', () => {
            logger.info('[CRON] Sending same-day duty reminders');
            DutyRosterService.sendDailySameDayReminders().catch(err => {
                logger.error('[CRON] Duty same-day reminder error:', err);
            });
        });

        // 3. Weekly summary reminder: Sunday 6:00 PM EAT (15:00 UTC)
        cron.schedule('0 15 * * 0', () => {
            logger.info('[CRON] Sending weekly duty summary reminders');
            DutyRosterService.sendWeeklySummaries().catch(err => {
                logger.error('[CRON] Duty weekly summary error:', err);
            });
        });

        logger.info('🚀 Background jobs successfully scheduled');

        // ── Approval Engine ───────────────────────────────────────────────────
        // Every 5 minutes — check for expired approval windows (score unlock, etc.)
        cron.schedule('*/5 * * * *', () => {
            approvalEngineService.processExpiredRequests().catch(err => {
                logger.error('[CRON] Approval expiry processing error:', err);
            });
        });

        // ── LMS Assignment Due Tomorrow Reminders ─────────────────────────────
        // Daily at 8:00 PM EAT (17:00 UTC) — remind students about assignments due tomorrow
        cron.schedule('0 17 * * *', () => {
            logger.info('[CRON] Sending assignment due-tomorrow reminders');
            sendAssignmentDueTomorrowReminders().catch(err => {
                logger.error('[CRON] Assignment due-tomorrow reminder error:', err);
            });
        });

        // ── Absent Learner SMS ────────────────────────────────────────────────
        // Daily at 09:30 EAT (06:30 UTC) — notify parents of absent learners
        cron.schedule('30 6 * * *', () => {
            logger.info('[CRON] Running absent learner SMS worker');
            runAbsentLearnerSmsWorker().catch(err => {
                logger.error('[CRON] Absent learner SMS worker error:', err);
            });
        });

        // ── SMS Retry Worker ──────────────────────────────────────────────────
        // Every hour — retry failed SMS records with exponential back-off
        cron.schedule('0 * * * *', () => {
            logger.info('[CRON] Running SMS retry worker');
            runSmsRetryWorker().catch(err => {
                logger.error('[CRON] SMS retry worker error:', err);
            });
        });

        // ── Chronic Absenteeism Worker ────────────────────────────────────────
        // Monday 07:00 EAT (04:00 UTC) — flag learners with high absence rates
        cron.schedule('0 4 * * 1', () => {
            logger.info('[CRON] Running chronic absenteeism check');
            runChronicAbsentWorker().catch(err => {
                logger.error('[CRON] Chronic absenteeism worker error:', err);
            });
        });

        // ── Biometric Sync Worker ─────────────────────────────────────────────
        // Every 15 minutes — pull attendance from PULL-mode ZKTeco devices
        cron.schedule('*/15 * * * *', () => {
            runBiometricSyncWorker().catch(err => {
                logger.error('[CRON] Biometric sync worker error:', err);
            });
        });

        // ── Biometric Log Retry Worker ────────────────────────────────────────
        // Daily 02:00 UTC — retry FAILED biometric log records
        cron.schedule('0 2 * * *', () => {
            logger.info('[CRON] Running biometric log retry worker');
            runBiometricLogRetryWorker().catch(err => {
                logger.error('[CRON] Biometric log retry worker error:', err);
            });
        });

        // ── Exeat Overdue Worker ──────────────────────────────────────────────
        // Daily 06:00 EAT (03:00 UTC) — detect learners who haven't returned from leave
        cron.schedule('0 3 * * *', () => {
            logger.info('[CRON] Running exeat overdue check');
            runExeatOverdueWorker().catch(err => {
                logger.error('[CRON] Exeat overdue worker error:', err);
            });
        });

        // ── Early Warning Checks ──────────────────────────────────────────────
        // Daily 23:00 UTC — run all presence rule checks for the school
        cron.schedule('0 23 * * *', async () => {
            logger.info('[CRON] Running early warning checks');
            try {
                const school = await prisma.school.findFirst({
                    where: { archived: false, active: true },
                    select: { id: true },
                    orderBy: { createdAt: 'asc' }
                });
                if (school) {
                    await earlyWarningService.runAllChecks(school.id);
                }
            } catch (err) {
                logger.error('[CRON] Early warning check error:', err);
            }
        });

    } catch (error) {
        logger.error('❌ Failed to start cron worker:', error);
        process.exit(1);
    }
}

startCronWorker();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Cron worker SIGTERM received — shutting down');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Cron worker SIGINT received — shutting down');
    await prisma.$disconnect();
    process.exit(0);
});
