import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  approveDecisionPlan,
  CounsellorDecisionOutcome,
  getDecisionPlan,
  lockDecisionPlan,
  ParentDecisionOutcome,
  reviewDecisionPlanAsCounsellor,
  reviewDecisionPlanAsParent,
  submitDecisionPlan,
} from '../services/decision-plan.service';
import { NotificationService, NotificationType } from '../services/notification.service';
import { ApiError } from '../utils/error.util';
import { hasAnyRole } from '../utils/roleNormalizer';

const SUBMITTER_ROLES = [
  'STUDENT',
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
];

function actorId(req: AuthRequest): string {
  const id = req.user?.userId;
  if (!id) throw new ApiError(401, 'Authentication required');
  return id;
}

async function notifyLearnerAndParent(learnerId: string, title: string, message: string) {
  try {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { admissionNumber: true, parentId: true },
    });
    if (!learner) return;
    const student = learner.admissionNumber
      ? await prisma.user.findUnique({
          where: { username: learner.admissionNumber },
          select: { id: true },
        })
      : null;
    const recipients = Array.from(new Set([
      ...(student ? [student.id] : []),
      ...(learner.parentId ? [learner.parentId] : []),
    ]));
    await Promise.allSettled(recipients.map(userId =>
      NotificationService.createNotification({
        userId,
        title,
        message,
        type: NotificationType.INFO,
        link: '/app/student-pathway-planner',
      })
    ));
  } catch {
    // The lifecycle transition remains authoritative if a delivery channel is unavailable.
  }
}

export const decisionPlanController = {
  get: async (req: AuthRequest, res: Response) => {
    const data = await getDecisionPlan(req.params.learnerId, {
      actorId: actorId(req),
      role: String(req.user?.role || ''),
    });
    res.json({ success: true, data });
  },

  submit: async (req: AuthRequest, res: Response) => {
    if (!hasAnyRole(req.user, SUBMITTER_ROLES)) {
      throw new ApiError(403, 'Only the learner or authorized pathway staff can submit this plan');
    }
    const data = await submitDecisionPlan({
      learnerId: req.params.learnerId,
      actorId: actorId(req),
      learnerStatement: req.body?.learnerStatement,
    });
    await notifyLearnerAndParent(
      req.params.learnerId,
      'Decision plan submitted',
      `Decision plan version ${data.version} is ready for parent review.`,
    );
    res.status(201).json({ success: true, data });
  },

  parentReview: async (req: AuthRequest, res: Response) => {
    const outcome = String(req.body?.outcome || '').toUpperCase() as ParentDecisionOutcome;
    if (!['APPROVE', 'REQUEST_REVISION', 'NEEDS_COUNSELLING'].includes(outcome)) {
      throw new ApiError(422, 'Parent outcome must be APPROVE, REQUEST_REVISION, or NEEDS_COUNSELLING');
    }
    const data = await reviewDecisionPlanAsParent({
      learnerId: req.params.learnerId,
      actorId: actorId(req),
      outcome,
      comment: req.body?.comment,
      visibility: req.body?.visibility,
      revision: req.body?.revision,
    });
    await notifyLearnerAndParent(
      req.params.learnerId,
      outcome === 'APPROVE' ? 'Parent review complete' : 'Decision plan needs revision',
      outcome === 'APPROVE'
        ? 'Your parent or guardian has reviewed the decision plan.'
        : 'Your parent or guardian requested changes to the decision plan.',
    );
    res.json({ success: true, data });
  },

  counsellorReview: async (req: AuthRequest, res: Response) => {
    const outcome = String(req.body?.outcome || '').toUpperCase() as CounsellorDecisionOutcome;
    if (!['APPROVE', 'REQUEST_REVISION'].includes(outcome)) {
      throw new ApiError(422, 'Counsellor outcome must be APPROVE or REQUEST_REVISION');
    }
    const data = await reviewDecisionPlanAsCounsellor({
      learnerId: req.params.learnerId,
      actorId: actorId(req),
      actorRole: String(req.user?.role || 'HEAD_OF_CURRICULUM'),
      outcome,
      revision: req.body?.revision,
    });
    await notifyLearnerAndParent(
      req.params.learnerId,
      outcome === 'APPROVE' ? 'Counsellor review complete' : 'Counsellor requested revision',
      outcome === 'APPROVE'
        ? 'The counsellor has completed the professional review of your decision plan.'
        : 'The counsellor requested changes before the decision plan can be approved.',
    );
    res.json({ success: true, data });
  },

  approve: async (req: AuthRequest, res: Response) => {
    const data = await approveDecisionPlan(req.params.learnerId, actorId(req));
    await notifyLearnerAndParent(
      req.params.learnerId,
      'Decision plan approved',
      'Your pathway decision plan has been approved and is awaiting final lock.',
    );
    res.json({ success: true, data });
  },

  lock: async (req: AuthRequest, res: Response) => {
    const data = await lockDecisionPlan(req.params.learnerId, actorId(req));
    await notifyLearnerAndParent(
      req.params.learnerId,
      'Decision plan locked',
      'Your pathway decision plan is now final and locked.',
    );
    res.json({ success: true, data });
  },
};
