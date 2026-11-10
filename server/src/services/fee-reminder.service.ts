/**
 * Fee Reminder Service — CRON Job (F-27)
 *
 * Sends automated SMS reminders to parents/guardians for invoices that are
 * overdue or partially paid. Reminders are sent at configurable intervals
 * (default: 7, 14, and 30 days past dueDate).
 *
 * Features:
 *  - Configurable cadence via CommunicationConfig (feeReminderSchedule JSON)
 *  - Per-learner opt-out (Learner.feeReminderOptOut)
 *  - Max 1 reminder per invoice per day (deduplication)
 *  - Logs every reminder as a FeeComment (type: REMINDER_SENT)
 *  - Skips WAIVED / CANCELLED / fully PAID invoices
 *  - Respects smsEnabled flag — won't send if SMS is disabled
 */

import prisma from '../config/database';
import { SmsService } from './sms.service';
import { whatsappService } from './whatsapp.service';
import logger from '../utils/logger';

// Default reminder cadence: days after dueDate
const DEFAULT_CADENCE_DAYS = [7, 14, 30];

// Maximum reminders per invoice (safety cap to avoid infinite reminders)
const MAX_REMINDERS_PER_INVOICE = 5;

interface ReminderResult {
  totalCandidates: number;
  remindersSent: number;
  smsFailures: number;
  optOutsSkipped: number;
}

export class FeeReminderService {

  /**
   * Main entry point — called by cron scheduler.
   * Finds all overdue/partial invoices due for a reminder and sends SMS.
   */
  async runReminderBatch(): Promise<ReminderResult> {
    const result: ReminderResult = {
      totalCandidates: 0,
      remindersSent: 0,
      smsFailures: 0,
      optOutsSkipped: 0,
    };

    logger.info('[FeeReminder] Starting fee reminder batch...');

    // 1. Get the communication config (school-level)
    const commConfig = await prisma.communicationConfig.findFirst();
    if (!commConfig) {
      logger.info('[FeeReminder] No CommunicationConfig found — skipping');
      return result;
    }

    // 2. Skip if SMS is not enabled
    if (!commConfig.smsEnabled) {
      logger.info('[FeeReminder] SMS is disabled — skipping reminder batch');
      return result;
    }

    // 3. Determine cadence from config or use defaults
    const cadenceDays: number[] = this.parseCadence(commConfig.emailTemplates as any);
    logger.info(`[FeeReminder] Using cadence: ${cadenceDays.join(', ')} days after due`);

    // 4. Find a system user for audit logging
    const systemUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    if (!systemUser) {
      logger.error('[FeeReminder] No SUPER_ADMIN user found for audit logging — skipping');
      return result;
    }

    // 5. Calculate date thresholds for each cadence tier
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const daysOverdue of cadenceDays) {
      const thresholdDate = new Date(now);
      thresholdDate.setDate(thresholdDate.getDate() - daysOverdue);

      // Find invoices that are exactly N days overdue (within a 1-day window)
      // and are NOT fully paid, waived, or cancelled
      const invoices = await prisma.feeInvoice.findMany({
        where: {
          archived: false,
          dueDate: {
            gte: new Date(thresholdDate.getTime() - 24 * 60 * 60 * 1000),
            lt: thresholdDate,
          },
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        include: {
          learner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryContactPhone: true,
              guardianPhone: true,
              primaryContactName: true,
              feeReminderOptOut: true,
            },
          },
          comments: {
            where: { type: 'REMINDER_SENT' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      logger.info(
        `[FeeReminder] Day-${daysOverdue} tier: found ${invoices.length} candidate invoice(s)`,
      );
      result.totalCandidates += invoices.length;

      for (const invoice of invoices) {
        try {
          // Skip if learner has opted out
          if (invoice.learner.feeReminderOptOut) {
            result.optOutsSkipped++;
            continue;
          }

          // Skip if we already sent a reminder today (deduplication)
          if (invoice.comments.length > 0) {
            const lastReminder = invoice.comments[0];
            const lastReminderDate = new Date(lastReminder.createdAt);
            lastReminderDate.setHours(0, 0, 0, 0);
            if (lastReminderDate.getTime() === now.getTime()) {
              continue; // Already reminded today
            }
          }

          // Count total reminders for this invoice — cap at MAX_REMINDERS_PER_INVOICE
          const totalReminders = await prisma.feeComment.count({
            where: { invoiceId: invoice.id, type: 'REMINDER_SENT' },
          });
          if (totalReminders >= MAX_REMINDERS_PER_INVOICE) {
            logger.info(
              `[FeeReminder] Invoice ${invoice.invoiceNumber} reached max reminders (${MAX_REMINDERS_PER_INVOICE}) — skipping`,
            );
            continue;
          }

          const phone =
            invoice.learner.primaryContactPhone || invoice.learner.guardianPhone;
          if (!phone) {
            logger.info(
              `[FeeReminder] No phone for learner ${invoice.learner.id} on invoice ${invoice.invoiceNumber} — skipping`,
            );
            continue;
          }

          const parentName = invoice.learner.primaryContactName || 'Parent/Guardian';
          const learnerName = `${invoice.learner.firstName} ${invoice.learner.lastName}`;
          const balance = Number(invoice.balance).toLocaleString('en-KE');
          const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-GB');

          const message =
            `Dear ${parentName}, this is a reminder that ${learnerName}'s school fees ` +
            `balance of KES ${balance} was due on ${dueDateStr}. ` +
            `Please clear the balance at your earliest convenience. ` +
            `Invoice: ${invoice.invoiceNumber}. Thank you.`;

          // Send SMS
          try {
            await SmsService.sendSms(phone, message);
            result.remindersSent++;
          } catch (smsErr: any) {
            logger.error(
              `[FeeReminder] SMS failed for invoice ${invoice.invoiceNumber}: ${smsErr?.message ?? smsErr}`,
            );
            result.smsFailures++;
            // Still log the attempt as a comment
          }

          // Try WhatsApp too (non-blocking, silently ignore failures)
          try {
            await whatsappService.sendMessage({ to: phone, message });
          } catch {
            // WhatsApp is best-effort
          }

          // Log the reminder as a FeeComment
          await prisma.feeComment.create({
            data: {
              invoiceId: invoice.id,
              type: 'REMINDER_SENT',
              body:
                `Automated fee reminder (day-${daysOverdue}) sent to ${parentName} (${phone}) ` +
                `for balance KES ${balance}. Invoice ${invoice.invoiceNumber}.`,
              isInternal: true,
              createdById: systemUser.id,
            },
          });
        } catch (err: any) {
          logger.error(
            `[FeeReminder] Error processing invoice ${invoice.invoiceNumber}: ${err?.message ?? err}`,
          );
        }
      }
    }

    logger.info(
      `[FeeReminder] Batch complete. Sent: ${result.remindersSent}, ` +
      `SMS failures: ${result.smsFailures}, Opt-outs skipped: ${result.optOutsSkipped}`,
    );
    return result;
  }

  /**
   * Parse the reminder cadence from CommunicationConfig.
   * Stored in the emailTemplates JSON as feeReminderSchedule: { cadenceDays: [7, 14, 30] }
   * Falls back to DEFAULT_CADENCE_DAYS if not configured.
   */
  private parseCadence(configJson: any): number[] {
    try {
      if (configJson && typeof configJson === 'object') {
        const schedule = configJson.feeReminderSchedule;
        if (schedule && Array.isArray(schedule.cadenceDays)) {
          const days = schedule.cadenceDays
            .map((d: any) => Number(d))
            .filter((d: number) => !isNaN(d) && d > 0)
            .sort((a: number, b: number) => a - b);
          if (days.length > 0) return days;
        }
      }
    } catch {
      // Fall through to defaults
    }
    return [...DEFAULT_CADENCE_DAYS];
  }
}

export const feeReminderService = new FeeReminderService();
