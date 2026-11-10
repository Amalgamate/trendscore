/**
 * SchoolNotificationTriggerService
 * =================================
 *
 * Unified notification trigger layer for all school-domain events.
 *
 * This service is the single entry point that controllers and domain services
 * call when a real-world school action happens (fee payment, attendance mark,
 * library overdue, transport trip, exam results published, etc.).
 *
 * It orchestrates three delivery channels in one call:
 *   1. In-app notification  → NotificationService.createNotification()
 *      (writes to user_notifications table, emits socket.io, sends web push)
 *   2. SMS                   → SmsService.sendSms()
 *   3. WhatsApp (WABA)       → whatsAppBusinessService.sendText()
 *
 * Design principles:
 *   - Fire-and-forget: every method catches its own errors and logs them.
 *     Callers never need to await (though they can) and never handle failures.
 *   - Channel fan-out is parallel via Promise.allSettled — one channel failing
 *     never blocks another.
 *   - User resolution: if the target person (parent, student, teacher) has a
 *     User account, an in-app notification is created. If they have a phone,
 *     SMS/WhatsApp is attempted. Both are independent.
 *   - Role-based admin notifications use NotificationService.notifyRoles().
 *
 * Pattern follows lms-notification.service.ts — the gold standard in this
 * codebase for multi-channel notification dispatch.
 */

import prisma from '../config/database';
import {
  NotificationService,
  NotificationType,
} from './notification.service';
import { SmsService } from './sms.service';
import {
  whatsAppBusinessService,
  isWabaConfigured,
} from '../domains/communication/whatsapp-business.service';
import logger from '../utils/logger';
import { resolveStudentUserIdsForLearners } from './student-account-link.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchoolNotificationChannel = 'IN_APP' | 'SMS' | 'WHATSAPP';

export interface SchoolNotificationRecipient {
  /** User.id for in-app notification. If null, skip in-app. */
  userId?: string | null;
  /** E.164 phone for SMS/WhatsApp. If null, skip channels. */
  phone?: string | null;
  /** Display name for logging */
  name?: string;
}

export interface SchoolNotificationPayload {
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  /** Show as popup in the UI */
  showAsPopup?: boolean;
  /** Additional metadata stored with the notification */
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Helpers (shared resolution utilities)
// ---------------------------------------------------------------------------

/**
 * Resolve the User.id for a learner's parent (via Learner.parentId).
 */
async function resolveParentUserId(learnerId: string): Promise<string | null> {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { parentId: true },
  });
  return learner?.parentId ?? null;
}

/**
 * Resolve a learner's parent phone using the same fallback chain as
 * attendance-notification.service.ts:
 * parent.phone → primaryContactPhone → guardianPhone → motherPhone → fatherPhone
 */
async function resolveParentPhone(learnerId: string): Promise<string | null> {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: {
      parent: { select: { phone: true } },
      primaryContactPhone: true,
      guardianPhone: true,
      motherPhone: true,
      fatherPhone: true,
    },
  });
  if (!learner) return null;
  return (
    learner.parent?.phone ||
    learner.primaryContactPhone ||
    learner.guardianPhone ||
    learner.motherPhone ||
    learner.fatherPhone ||
    null
  );
}

/**
 * Resolve a learner's name for personalized messages.
 */
async function resolveLearnerName(learnerId: string): Promise<string> {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { firstName: true, lastName: true },
  });
  if (!learner) return 'your child';
  return `${learner.firstName} ${learner.lastName}`;
}

/**
 * Resolve the student's User.id from a learnerId.
 */
async function resolveStudentUserId(learnerId: string): Promise<string | null> {
  return (await resolveStudentUserIdsForLearners([learnerId]))[0] ?? null;
}

// ---------------------------------------------------------------------------
// Core dispatch — sends to all three channels in parallel
// ---------------------------------------------------------------------------

/**
 * Send a notification to a single recipient across all available channels.
 * Each channel is independent — one failing does not block the others.
 */
async function dispatchToRecipient(
  recipient: SchoolNotificationRecipient,
  payload: SchoolNotificationPayload,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  // 1. In-app notification
  if (recipient.userId) {
    tasks.push(
      NotificationService.createNotification({
        userId: recipient.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? NotificationType.INFO,
        link: payload.link,
        showAsPopup: payload.showAsPopup ?? false,
        metadata: payload.metadata,
      })
        .then(() => {
          logger.debug('[SchoolNotification] In-app sent', {
            userId: recipient.userId,
            title: payload.title,
          });
        })
        .catch((err) =>
          logger.warn('[SchoolNotification] In-app failed', {
            userId: recipient.userId,
            error: err?.message,
          }),
        ),
    );
  }

  // 2. SMS
  if (recipient.phone) {
    tasks.push(
      SmsService.sendSms(recipient.phone, payload.message)
        .then((result) => {
          if (result.success) {
            logger.info('[SchoolNotification] SMS sent', {
              phone: recipient.phone!.slice(0, 7) + '****',
              title: payload.title,
            });
          } else {
            logger.warn('[SchoolNotification] SMS failed', {
              error: result.error,
            });
          }
        })
        .catch((err) =>
          logger.warn('[SchoolNotification] SMS exception', {
            error: err?.message,
          }),
        ),
    );

    // 3. WhatsApp (WABA only)
    if (isWabaConfigured()) {
      tasks.push(
        whatsAppBusinessService
          .sendText({ to: recipient.phone, body: payload.message })
          .then((result) => {
            logger.info('[SchoolNotification] WhatsApp sent', {
              success: result.success,
            });
          })
          .catch((err) =>
            logger.warn('[SchoolNotification] WhatsApp exception', {
              error: err?.message,
            }),
          ),
      );
    }
  }

  await Promise.allSettled(tasks);
}

/**
 * Notify multiple role-based users (admins, accountants, etc.) via in-app only.
 */
async function dispatchToRoles(
  roles: string[],
  payload: SchoolNotificationPayload,
): Promise<void> {
  try {
    await NotificationService.notifyRoles(roles, {
      title: payload.title,
      message: payload.message,
      type: payload.type ?? NotificationType.INFO,
      link: payload.link,
      showAsPopup: payload.showAsPopup ?? false,
      metadata: payload.metadata,
    });
  } catch (err: any) {
    logger.warn('[SchoolNotification] Role notification failed', {
      roles,
      error: err?.message,
    });
  }
}

// ---------------------------------------------------------------------------
// SchoolNotificationTriggerService
// ---------------------------------------------------------------------------

export class SchoolNotificationTriggerService {
  // =====================================================================
  // FEES
  // =====================================================================

  /**
   * Triggered when a fee payment is recorded.
   *
   * Notifies:
   *  - Parent: in-app + SMS + WhatsApp (payment confirmation, balance update)
   *  - Admin/Accountant roles: in-app (payment recorded for audit)
   */
  static async onFeePaymentRecorded(params: {
    learnerId: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    receiptNumber: string;
    balance: number;
    invoiceStatus: string;
    paymentMethod: string;
    schoolName?: string;
  }): Promise<void> {
    try {
      const {
        learnerId,
        invoiceId,
        invoiceNumber,
        amount,
        receiptNumber,
        balance,
        invoiceStatus,
        schoolName,
      } = params;

      const parentUserId = await resolveParentUserId(learnerId);
      const parentPhone = await resolveParentPhone(learnerId);
      const learnerName = await resolveLearnerName(learnerId);

      const statusLabel = invoiceStatus === 'PAID'
        ? 'Invoice fully settled'
        : invoiceStatus === 'OVERPAID'
          ? 'Credit balance'
          : 'Outstanding balance';

      // ── Parent notification ──
      const parentMessage =
        `Payment of KES ${amount.toLocaleString()} received for ${learnerName}. ` +
        `Receipt: ${receiptNumber}. ${statusLabel}: KES ${Math.abs(balance).toLocaleString()}. ` +
        `Thank you${schoolName ? `, ${schoolName}` : ''}.`;

      const parentRecipient: SchoolNotificationRecipient = {
        userId: parentUserId,
        phone: parentPhone,
        name: `Parent of ${learnerName}`,
      };

      await dispatchToRecipient(parentRecipient, {
        title: 'Payment Received',
        message: parentMessage,
        type: NotificationType.SUCCESS,
        link: `/app/parent-portal-fees`,
        metadata: {
          module: 'FEES',
          event: 'PAYMENT_RECORDED',
          invoiceId,
          invoiceNumber,
          receiptNumber,
          amount,
          balance,
          invoiceStatus,
        },
      });

      // ── Admin/Accountant notification ──
      await dispatchToRoles(['ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'], {
        title: 'Fee Payment Recorded',
        message: `KES ${amount.toLocaleString()} received for ${learnerName} (${invoiceNumber}). Receipt: ${receiptNumber}. Status: ${invoiceStatus}.`,
        type: NotificationType.SUCCESS,
        link: `/app/fees/invoices/${invoiceId}`,
        metadata: {
          module: 'FEES',
          event: 'PAYMENT_RECORDED',
          invoiceId,
          invoiceNumber,
          receiptNumber,
          amount,
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onFeePaymentRecorded error:', err?.message ?? err);
    }
  }

  /**
   * Triggered when a new invoice is generated.
   *
   * Notifies:
   *  - Parent: in-app + SMS (invoice generated, amount due)
   */
  static async onInvoiceGenerated(params: {
    learnerId: string;
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    dueDate?: Date | null;
    term?: string;
    academicYear?: string;
  }): Promise<void> {
    try {
      const { learnerId, invoiceId, invoiceNumber, totalAmount, dueDate, term, academicYear } = params;

      const parentUserId = await resolveParentUserId(learnerId);
      const parentPhone = await resolveParentPhone(learnerId);
      const learnerName = await resolveLearnerName(learnerId);

      const dueStr = dueDate
        ? ` Due by ${new Date(dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : '';

      const termStr = [term, academicYear].filter(Boolean).join(' ') || '';

      const message =
        `Fee invoice ${invoiceNumber} has been generated for ${learnerName}` +
        (termStr ? ` (${termStr})` : '') +
        `. Amount: KES ${Number(totalAmount).toLocaleString()}.${dueStr} ` +
        `Please log in to view and pay.`;

      const recipient: SchoolNotificationRecipient = {
        userId: parentUserId,
        phone: parentPhone,
        name: `Parent of ${learnerName}`,
      };

      await dispatchToRecipient(recipient, {
        title: 'New Fee Invoice',
        message,
        type: NotificationType.INFO,
        link: `/app/parent-portal-fees`,
        metadata: {
          module: 'FEES',
          event: 'INVOICE_GENERATED',
          invoiceId,
          invoiceNumber,
          totalAmount,
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onInvoiceGenerated error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // ATTENDANCE
  // =====================================================================

  /**
   * Triggered when a learner is marked absent.
   *
   * Notifies:
   *  - Parent: in-app + SMS + WhatsApp
   */
  static async onLearnerAbsent(params: {
    learnerId: string;
    schoolName: string;
    date: Date;
  }): Promise<void> {
    try {
      const { learnerId, schoolName, date } = params;

      const parentUserId = await resolveParentUserId(learnerId);
      const parentPhone = await resolveParentPhone(learnerId);
      const learnerName = await resolveLearnerName(learnerId);

      const dateStr = date.toLocaleDateString('en-KE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      const message =
        `Dear Parent, ${learnerName} was marked ABSENT from ${schoolName} on ${dateStr}. ` +
        `Please contact the school if this is unexpected.`;

      const recipient: SchoolNotificationRecipient = {
        userId: parentUserId,
        phone: parentPhone,
        name: `Parent of ${learnerName}`,
      };

      await dispatchToRecipient(recipient, {
        title: 'Absence Notification',
        message,
        type: NotificationType.WARNING,
        link: `/app/parent-portal-attendance`,
        showAsPopup: true,
        metadata: {
          module: 'ATTENDANCE',
          event: 'MANUAL_ABSENT',
          learnerId,
          date: date.toISOString(),
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onLearnerAbsent error:', err?.message ?? err);
    }
  }

  /**
   * Triggered when a learner arrives at / leaves school via gate scan.
   *
   * Notifies:
   *  - Parent: in-app + SMS + WhatsApp
   */
  static async onGateEvent(params: {
    learnerId: string;
    schoolName: string;
    eventType: 'GATE_ENTRY' | 'GATE_EXIT' | 'BUS_BOARDED' | 'BUS_ALIGHTED';
    timestamp: Date;
  }): Promise<void> {
    try {
      const { learnerId, schoolName, eventType, timestamp } = params;

      const parentUserId = await resolveParentUserId(learnerId);
      const parentPhone = await resolveParentPhone(learnerId);
      const learnerName = await resolveLearnerName(learnerId);

      // Format time in EAT (UTC+3)
      const eat = new Date(timestamp.getTime() + 3 * 60 * 60 * 1000);
      const hh = String(eat.getUTCHours()).padStart(2, '0');
      const mm = String(eat.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      const dateStr = timestamp.toLocaleDateString('en-KE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      let title: string;
      let message: string;

      switch (eventType) {
        case 'GATE_ENTRY':
          title = 'Child Arrived at School';
          message = `${learnerName} has arrived at ${schoolName} at ${timeStr} EAT on ${dateStr}. They are safely on school grounds.`;
          break;
        case 'GATE_EXIT':
          title = 'Child Left School';
          message = `${learnerName} has left ${schoolName} at ${timeStr} EAT on ${dateStr}. Please ensure they arrive home safely.`;
          break;
        case 'BUS_BOARDED':
          title = 'Child Boarded School Bus';
          message = `${learnerName} has boarded the school bus at ${timeStr} EAT. They are on their way to school.`;
          break;
        case 'BUS_ALIGHTED':
          title = 'Child Alighted from School Bus';
          message = `${learnerName} has alighted from the school bus at ${timeStr} EAT. Please ensure they arrive home safely.`;
          break;
      }

      const recipient: SchoolNotificationRecipient = {
        userId: parentUserId,
        phone: parentPhone,
        name: `Parent of ${learnerName}`,
      };

      await dispatchToRecipient(recipient, {
        title,
        message,
        type: NotificationType.INFO,
        link: `/app/parent-portal-attendance`,
        metadata: {
          module: 'ATTENDANCE',
          event: eventType,
          learnerId,
          timestamp: timestamp.toISOString(),
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onGateEvent error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // LIBRARY
  // =====================================================================

  /**
   * Triggered when a library book is overdue.
   *
   * Notifies:
   *  - Student: in-app (if they have an account)
   *  - Parent: in-app + SMS (overdue book reminder)
   */
  static async onBookOverdue(params: {
    learnerId: string;
    bookTitle: string;
    bookId?: string;
    dueDate: Date;
    fineAmount?: number;
  }): Promise<void> {
    try {
      const { learnerId, bookTitle, dueDate, fineAmount } = params;

      const studentUserId = await resolveStudentUserId(learnerId);
      const parentUserId = await resolveParentUserId(learnerId);
      const parentPhone = await resolveParentPhone(learnerId);
      const learnerName = await resolveLearnerName(learnerId);

      const dueStr = new Date(dueDate).toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
      });

      const fineStr = fineAmount && fineAmount > 0
        ? ` A fine of KES ${fineAmount.toLocaleString()} may apply.`
        : '';

      const message =
        `"${bookTitle}" borrowed by ${learnerName} was due on ${dueStr} and is now overdue.${fineStr} ` +
        `Please return it to the library as soon as possible.`;

      // Notify student (in-app only)
      if (studentUserId) {
        await dispatchToRecipient(
          { userId: studentUserId },
          {
            title: 'Library Book Overdue',
            message,
            type: NotificationType.WARNING,
            link: `/app/library`,
            metadata: {
              module: 'LIBRARY',
              event: 'BOOK_OVERDUE',
              learnerId,
              bookTitle,
            },
          },
        );
      }

      // Notify parent (in-app + SMS)
      const recipient: SchoolNotificationRecipient = {
        userId: parentUserId,
        phone: parentPhone,
        name: `Parent of ${learnerName}`,
      };

      await dispatchToRecipient(recipient, {
        title: 'Library Book Overdue',
        message,
        type: NotificationType.WARNING,
        link: `/app/parent-portal`,
        metadata: {
          module: 'LIBRARY',
          event: 'BOOK_OVERDUE',
          learnerId,
          bookTitle,
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onBookOverdue error:', err?.message ?? err);
    }
  }

  /**
   * Triggered when a reserved book becomes available.
   *
   * Notifies:
   *  - Student: in-app
   */
  static async onBookAvailable(params: {
    learnerId: string;
    bookTitle: string;
  }): Promise<void> {
    try {
      const { learnerId, bookTitle } = params;
      const studentUserId = await resolveStudentUserId(learnerId);

      if (!studentUserId) return;

      await dispatchToRecipient(
        { userId: studentUserId },
        {
          title: 'Book Available',
          message: `"${bookTitle}" is now available for collection from the library. Please collect it within 2 days.`,
          type: NotificationType.SUCCESS,
          link: `/app/library`,
          metadata: {
            module: 'LIBRARY',
            event: 'BOOK_AVAILABLE',
            learnerId,
            bookTitle,
          },
        },
      );
    } catch (err: any) {
      logger.error('[SchoolNotification] onBookAvailable error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // TRANSPORT
  // =====================================================================

  /**
   * Triggered when a transport route or schedule changes.
   *
   * Notifies:
   *  - All parents on the route: in-app + SMS
   *  - Transport admin: in-app
   */
  static async onTransportRouteChanged(params: {
    routeName: string;
    changeDescription: string;
    affectedLearnerIds: string[];
    effectiveDate?: Date;
  }): Promise<void> {
    try {
      const { routeName, changeDescription, affectedLearnerIds, effectiveDate } = params;

      const dateStr = effectiveDate
        ? ` Effective from ${new Date(effectiveDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })}.`
        : '';

      const message =
        `Transport route "${routeName}" has been updated: ${changeDescription}.${dateStr} ` +
        `Please check the transport portal for the new schedule.`;

      // Notify each affected parent
      await Promise.allSettled(
        affectedLearnerIds.map(async (learnerId) => {
          const parentUserId = await resolveParentUserId(learnerId);
          const parentPhone = await resolveParentPhone(learnerId);
          const learnerName = await resolveLearnerName(learnerId);

          const recipient: SchoolNotificationRecipient = {
            userId: parentUserId,
            phone: parentPhone,
            name: `Parent of ${learnerName}`,
          };

          await dispatchToRecipient(recipient, {
            title: 'Transport Route Update',
            message,
            type: NotificationType.WARNING,
            link: `/app/parent-portal-transport`,
            metadata: {
              module: 'TRANSPORT',
              event: 'ROUTE_CHANGED',
              routeName,
              learnerId,
            },
          });
        }),
      );

      // Notify transport admin
      await dispatchToRoles(['ADMIN', 'SUPER_ADMIN', 'TRANSPORT_ADMIN'], {
        title: 'Transport Route Updated',
        message: `Route "${routeName}" was updated: ${changeDescription}. ${affectedLearnerIds.length} parent(s) notified.`,
        type: NotificationType.INFO,
        link: `/app/transport`,
        metadata: {
          module: 'TRANSPORT',
          event: 'ROUTE_CHANGED',
          routeName,
          affectedCount: affectedLearnerIds.length,
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onTransportRouteChanged error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // EXAMS / GRADING
  // =====================================================================

  /**
   * Triggered when exam results are published.
   *
   * Notifies:
   *  - Student: in-app
   *  - Parent: in-app (results available)
   */
  static async onExamResultsPublished(params: {
    learnerIds: string[];
    examName: string;
    term?: string;
  }): Promise<void> {
    try {
      const { learnerIds, examName, term } = params;

      const termStr = term ? ` (${term})` : '';

      await Promise.allSettled(
        learnerIds.map(async (learnerId) => {
          const studentUserId = await resolveStudentUserId(learnerId);
          const parentUserId = await resolveParentUserId(learnerId);
          const learnerName = await resolveLearnerName(learnerId);

          // Notify student
          if (studentUserId) {
            await dispatchToRecipient(
              { userId: studentUserId },
              {
                title: 'Exam Results Available',
                message: `Your results for "${examName}"${termStr} are now available. Check the portal to view your grades.`,
                type: NotificationType.SUCCESS,
                link: `/app/exams/results`,
                metadata: {
                  module: 'EXAMS',
                  event: 'RESULTS_PUBLISHED',
                  examName,
                  learnerId,
                },
              },
            );
          }

          // Notify parent
          if (parentUserId) {
            await dispatchToRecipient(
              { userId: parentUserId },
              {
                title: 'Exam Results Published',
                message: `Exam results for "${examName}"${termStr} are now available for ${learnerName}. Check the parent portal to view.`,
                type: NotificationType.INFO,
                link: `/app/parent-portal-results`,
                metadata: {
                  module: 'EXAMS',
                  event: 'RESULTS_PUBLISHED',
                  examName,
                  learnerId,
                },
              },
            );
          }
        }),
      );
    } catch (err: any) {
      logger.error('[SchoolNotification] onExamResultsPublished error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // ADMISSICATIONS
  // =====================================================================

  /**
   * Triggered when a new learner is admitted.
   *
   * Notifies:
   *  - Admin: in-app (new admission)
   *  - Parent: in-app + SMS (welcome + account info)
   */
  static async onLearnerAdmitted(params: {
    learnerId: string;
    learnerName: string;
    grade: string;
    parentUserId?: string | null;
    parentPhone?: string | null;
    admissionNumber: string;
  }): Promise<void> {
    try {
      const { learnerId, learnerName, grade, parentUserId, parentPhone, admissionNumber } = params;

      // Notify parent
      if (parentUserId || parentPhone) {
        const message =
          `Welcome! ${learnerName} has been admitted to ${grade}. ` +
          `Admission number: ${admissionNumber}. ` +
          `You can now access the parent portal to track your child's progress.`;

        await dispatchToRecipient(
          { userId: parentUserId, phone: parentPhone, name: `Parent of ${learnerName}` },
          {
            title: 'Admission Confirmed',
            message,
            type: NotificationType.SUCCESS,
            link: `/app/parent-portal`,
            showAsPopup: true,
            metadata: {
              module: 'ADMISSIONS',
              event: 'LEARNER_ADMITTED',
              learnerId,
              admissionNumber,
            },
          },
        );
      }

      // Notify admin
      await dispatchToRoles(['ADMIN', 'SUPER_ADMIN'], {
        title: 'New Learner Admitted',
        message: `${learnerName} has been admitted to ${grade}. Admission #: ${admissionNumber}.`,
        type: NotificationType.INFO,
        link: `/app/learners`,
        metadata: {
          module: 'ADMISSIONS',
          event: 'LEARNER_ADMITTED',
          learnerId,
          admissionNumber,
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onLearnerAdmitted error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // ANNOUNCEMENTS / NOTICES
  // =====================================================================

  /**
   * Triggered when a school-wide announcement or notice is published.
   *
   * Notifies:
   *  - Target roles: in-app
   */
  static async onAnnouncementPublished(params: {
    title: string;
    body: string;
    targetRoles?: string[];
    link?: string;
  }): Promise<void> {
    try {
      const { title, body, targetRoles, link } = params;
      const roles = targetRoles && targetRoles.length > 0
        ? targetRoles
        : ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'SUPER_ADMIN'];

      await dispatchToRoles(roles, {
        title: `Announcement: ${title}`,
        message: body.slice(0, 200) + (body.length > 200 ? '...' : ''),
        type: NotificationType.INFO,
        link: link || `/app/announcements`,
        showAsPopup: true,
        metadata: {
          module: 'ANNOUNCEMENTS',
          event: 'PUBLISHED',
          title,
        },
      });
    } catch (err: any) {
      logger.error('[SchoolNotification] onAnnouncementPublished error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // TIMETABLE
  // =====================================================================

  /**
   * Triggered when a timetable is changed.
   *
   * Notifies:
   *  - Teachers: in-app
   *  - Students (if classes are affected): in-app
   */
  static async onTimetableChanged(params: {
    className: string;
    changeDescription: string;
    teacherUserIds?: string[];
    studentUserIds?: string[];
  }): Promise<void> {
    try {
      const { className, changeDescription, teacherUserIds, studentUserIds } = params;

      const message =
        `Timetable for ${className} has been updated: ${changeDescription}. ` +
        `Please check the portal for the new schedule.`;

      // Notify teachers
      if (teacherUserIds && teacherUserIds.length > 0) {
        await Promise.allSettled(
          teacherUserIds.map((userId) =>
            dispatchToRecipient(
              { userId },
              {
                title: 'Timetable Update',
                message,
                type: NotificationType.WARNING,
                link: `/app/timetable`,
                metadata: {
                  module: 'TIMETABLE',
                  event: 'CHANGED',
                  className,
                },
              },
            ),
          ),
        );
      }

      // Notify students
      if (studentUserIds && studentUserIds.length > 0) {
        await Promise.allSettled(
          studentUserIds.map((userId) =>
            dispatchToRecipient(
              { userId },
              {
                title: 'Timetable Update',
                message,
                type: NotificationType.WARNING,
                link: `/app/timetable`,
                metadata: {
                  module: 'TIMETABLE',
                  event: 'CHANGED',
                  className,
                },
              },
            ),
          ),
        );
      }
    } catch (err: any) {
      logger.error('[SchoolNotification] onTimetableChanged error:', err?.message ?? err);
    }
  }

  // =====================================================================
  // GENERIC DISPATCHER (for future modules)
  // =====================================================================

  /**
   * Generic notification dispatch — for modules that don't have a dedicated
   * method yet. Just pass the recipient info and payload.
   */
  static async dispatch(
    recipient: SchoolNotificationRecipient,
    payload: SchoolNotificationPayload,
  ): Promise<void> {
    try {
      await dispatchToRecipient(recipient, payload);
    } catch (err: any) {
      logger.error('[SchoolNotification] dispatch error:', err?.message ?? err);
    }
  }

  /**
   * Generic role-based notification dispatch.
   */
  static async dispatchToRoles(
    roles: string[],
    payload: SchoolNotificationPayload,
  ): Promise<void> {
    await dispatchToRoles(roles, payload);
  }
}

// Export the singleton helper functions for use in other services
export { resolveParentUserId, resolveParentPhone, resolveLearnerName, resolveStudentUserId };
