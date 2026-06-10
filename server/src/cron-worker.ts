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
