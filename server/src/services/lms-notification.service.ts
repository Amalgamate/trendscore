/**
 * LMSNotificationService
 *
 * Thin wrapper around the existing NotificationService that dispatches
 * all LMS-related event notifications. Every method is static and
 * fire-and-forget (errors are caught and logged, never re-thrown), so
 * callers never need to await these or handle notification failures.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9
 */

import prisma from '../config/database';
import {
  NotificationService,
  NotificationType,
} from './notification.service';
import type {
  LearningAssignment,
  LearningSubmission,
  LearningLesson,
  MarketplacePurchase,
  LMSSettings,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the User.id for a learner. Student accounts are linked to learners
 * by admission number matching the User.username (or its variants).
 * Returns null if no matching user account is found.
 */
async function resolveStudentUserId(learnerId: string): Promise<string | null> {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { admissionNumber: true },
  });
  if (!learner) return null;

  // Admission numbers may contain slashes stored as hyphens in username
  const usernameCandidates = [
    learner.admissionNumber,
    learner.admissionNumber.replace(/\//g, '-'),
  ];

  const user = await prisma.user.findFirst({
    where: {
      username: { in: usernameCandidates },
      role: 'STUDENT',
      archived: false,
    },
    select: { id: true },
  });

  return user?.id ?? null;
}

/**
 * Resolve the User.id for the parent of a learner (via Learner.parentId).
 * Returns null if the learner has no linked parent account.
 */
async function resolveParentUserId(learnerId: string): Promise<string | null> {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { parentId: true },
  });
  return learner?.parentId ?? null;
}

/**
 * Fetch all active learner user IDs for a given classId by joining
 * ClassEnrollment → Learner → User (STUDENT role).
 */
async function resolveClassStudentUserIds(
  classId: string,
  schoolId: string,
): Promise<string[]> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, active: true, archived: false },
    select: { learnerId: true },
  });

  if (enrollments.length === 0) return [];

  const learnerIds = enrollments.map((e) => e.learnerId);

  const learners = await prisma.learner.findMany({
    where: {
      id: { in: learnerIds },
      archived: false,
    },
    select: { admissionNumber: true },
  });

  if (learners.length === 0) return [];

  const usernameCandidates = learners.flatMap((l) => [
    l.admissionNumber,
    l.admissionNumber.replace(/\//g, '-'),
  ]);

  const users = await prisma.user.findMany({
    where: {
      username: { in: usernameCandidates },
      role: 'STUDENT',
      archived: false,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

/**
 * Fetch the LMSSettings for a school. Returns null if not yet configured
 * (callers should treat null the same as default settings).
 */
async function getLMSSettings(schoolId: string): Promise<LMSSettings | null> {
  return prisma.lMSSettings.findUnique({ where: { schoolId } });
}

// ---------------------------------------------------------------------------
// LMSNotificationService
// ---------------------------------------------------------------------------

export class LMSNotificationService {
  /**
   * Req 19.1 / 19.2
   * Fired when an assignment is published.
   * Notifies all enrolled students in the assignment's class.
   * Also notifies their parents if LMSSettings.notifyParents is true.
   */
  static async onAssignmentPublished(
    assignment: LearningAssignment,
  ): Promise<void> {
    try {
      const { id, schoolId, classId, title } = assignment;

      const studentUserIds = await resolveClassStudentUserIds(classId, schoolId);

      // Notify each student
      await Promise.allSettled(
        studentUserIds.map((userId) =>
          NotificationService.createNotification({
            userId,
            title: 'New Assignment',
            message: `A new assignment has been published: "${title}"`,
            type: NotificationType.INFO,
            link: `/app/learning/assignments/${id}`,
          }),
        ),
      );

      // Notify parents if setting is enabled
      const settings = await getLMSSettings(schoolId);
      if (settings?.notifyParents) {
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId, active: true, archived: false },
          select: { learnerId: true },
        });

        const parentNotifications = await Promise.allSettled(
          enrollments.map(async ({ learnerId }) => {
            const parentId = await resolveParentUserId(learnerId);
            if (!parentId) return;
            return NotificationService.createNotification({
              userId: parentId,
              title: 'New Assignment Published',
              message: `A new assignment "${title}" has been published for your child.`,
              type: NotificationType.INFO,
              link: `/app/learning/assignments/${id}`,
            });
          }),
        );

        const parentFailures = parentNotifications.filter(
          (r) => r.status === 'rejected',
        );
        if (parentFailures.length > 0) {
          console.warn(
            `[LMSNotificationService] onAssignmentPublished: ${parentFailures.length} parent notification(s) failed`,
          );
        }
      }
    } catch (err: any) {
      console.error(
        '[LMSNotificationService] onAssignmentPublished error:',
        err?.message ?? err,
      );
    }
  }

  /**
   * Req 19.3
   * Fired when a student submits an assignment.
   * Notifies the teacher who created the assignment.
   */
  static async onSubmissionReceived(
    submission: LearningSubmission,
  ): Promise<void> {
    try {
      const { assignmentId, learnerId } = submission;

      const assignment = await prisma.learningAssignment.findUnique({
        where: { id: assignmentId },
        select: { createdById: true, title: true },
      });

      if (!assignment) {
        console.warn(
          `[LMSNotificationService] onSubmissionReceived: assignment ${assignmentId} not found`,
        );
        return;
      }

      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { firstName: true, lastName: true },
      });

      const learnerName = learner
        ? `${learner.firstName} ${learner.lastName}`
        : 'A student';

      await NotificationService.createNotification({
        userId: assignment.createdById,
        title: 'New Submission Received',
        message: `${learnerName} has submitted "${assignment.title}".`,
        type: NotificationType.INFO,
        link: `/app/learning/assignments/${assignmentId}`,
      });
    } catch (err: any) {
      console.error(
        '[LMSNotificationService] onSubmissionReceived error:',
        err?.message ?? err,
      );
    }
  }

  /**
   * Req 19.4 / 19.5
   * Fired when a submission is marked.
   * Notifies the student. Also notifies their parent if LMSSettings.notifyParents is true.
   */
  static async onSubmissionMarked(
    submission: LearningSubmission,
  ): Promise<void> {
    try {
      const { id, assignmentId, learnerId } = submission;

      const assignment = await prisma.learningAssignment.findUnique({
        where: { id: assignmentId },
        select: { title: true, schoolId: true },
      });

      if (!assignment) {
        console.warn(
          `[LMSNotificationService] onSubmissionMarked: assignment ${assignmentId} not found`,
        );
        return;
      }

      const { title, schoolId } = assignment;

      // Notify the student
      const studentUserId = await resolveStudentUserId(learnerId);
      if (studentUserId) {
        await NotificationService.createNotification({
          userId: studentUserId,
          title: 'Assignment Marked',
          message: `Your submission for "${title}" has been marked. View your feedback now.`,
          type: NotificationType.SUCCESS,
          link: `/app/learning/assignments/${assignmentId}/submission/${id}`,
        });
      } else {
        console.warn(
          `[LMSNotificationService] onSubmissionMarked: no student user account found for learnerId ${learnerId}`,
        );
      }

      // Notify parent if setting is enabled
      const settings = await getLMSSettings(schoolId);
      if (settings?.notifyParents) {
        const parentId = await resolveParentUserId(learnerId);
        if (parentId) {
          await NotificationService.createNotification({
            userId: parentId,
            title: 'Teacher Feedback Available',
            message: `Your child's assignment "${title}" has been marked. Teacher feedback is now available.`,
            type: NotificationType.INFO,
            link: `/app/learning/assignments/${assignmentId}`,
          });
        }
      }
    } catch (err: any) {
      console.error(
        '[LMSNotificationService] onSubmissionMarked error:',
        err?.message ?? err,
      );
    }
  }

  /**
   * Req 19.6
   * Fired when a lesson is published.
   * Notifies all students enrolled in the lesson's class.
   */
  static async onLessonPublished(lesson: LearningLesson): Promise<void> {
    try {
      const { id, schoolId, classId, title } = lesson;

      const studentUserIds = await resolveClassStudentUserIds(classId, schoolId);

      await Promise.allSettled(
        studentUserIds.map((userId) =>
          NotificationService.createNotification({
            userId,
            title: 'New Lesson Available',
            message: `A new lesson has been published: "${title}"`,
            type: NotificationType.INFO,
            link: `/app/learning/lessons/${id}`,
          }),
        ),
      );
    } catch (err: any) {
      console.error(
        '[LMSNotificationService] onLessonPublished error:',
        err?.message ?? err,
      );
    }
  }

  /**
   * Req 19.8
   * Fired when a Marketplace purchase is completed.
   * Notifies the buyer with a "Purchase Successful" notification.
   * Notifies the seller with a "New Sale" notification.
   */
  static async onMarketplacePurchaseComplete(
    purchase: MarketplacePurchase,
  ): Promise<void> {
    try {
      const { id, buyerId, listingId } = purchase;

      const listing = await prisma.marketplaceListing.findUnique({
        where: { id: listingId },
        select: { title: true, sellerId: true },
      });

      if (!listing) {
        console.warn(
          `[LMSNotificationService] onMarketplacePurchaseComplete: listing ${listingId} not found`,
        );
        return;
      }

      const { title, sellerId } = listing;

      // Notify buyer
      await NotificationService.createNotification({
        userId: buyerId,
        title: 'Purchase Successful',
        message: `You have successfully purchased "${title}". You can now download it.`,
        type: NotificationType.SUCCESS,
        link: `/app/learning/marketplace/purchases/${id}`,
      });

      // Notify seller
      await NotificationService.createNotification({
        userId: sellerId,
        title: 'New Sale',
        message: `Your listing "${title}" was purchased. Your earnings have been credited.`,
        type: NotificationType.SUCCESS,
        link: `/app/learning/marketplace/listings`,
      });
    } catch (err: any) {
      console.error(
        '[LMSNotificationService] onMarketplacePurchaseComplete error:',
        err?.message ?? err,
      );
    }
  }

  /**
   * Req 19.7
   * Fired by the cron worker for assignments due tomorrow.
   * Bulk notifies the given array of learner user IDs who have not yet submitted.
   */
  static async onAssignmentDueTomorrow(
    assignment: LearningAssignment,
    learnerUserIds: string[],
  ): Promise<void> {
    try {
      const { id, title, dueDate } = assignment;

      if (learnerUserIds.length === 0) return;

      const dueDateStr = dueDate
        ? new Date(dueDate).toLocaleDateString('en-KE', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : 'tomorrow';

      await Promise.allSettled(
        learnerUserIds.map((userId) =>
          NotificationService.createNotification({
            userId,
            title: 'Assignment Due Tomorrow',
            message: `Reminder: "${title}" is due ${dueDateStr}. Make sure to submit before the deadline.`,
            type: NotificationType.WARNING,
            link: `/app/learning/assignments/${id}`,
          }),
        ),
      );
    } catch (err: any) {
      console.error(
        '[LMSNotificationService] onAssignmentDueTomorrow error:',
        err?.message ?? err,
      );
    }
  }
}
