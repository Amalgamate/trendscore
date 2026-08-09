import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import { PathwayService } from '../services/pathway.service';
import prisma from '../config/database';
import { NotificationService, NotificationType } from '../services/notification.service';

type PathwayNotificationEvent = 'RECOMMENDATION_READY' | 'DECISION_FINALIZED' | 'DECISION_OVERRIDDEN';

async function notifyPathwayUsers(learnerId: string, pathway: string, event: PathwayNotificationEvent) {
  try {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { admissionNumber: true, parentId: true },
    });
    if (!learner) return;
    const student = learner.admissionNumber
      ? await prisma.user.findUnique({ where: { username: learner.admissionNumber }, select: { id: true } })
      : null;
    const recipients = [
      ...(student?.id ? [{ userId: student.id, link: '/app/student-pathway-planner' }] : []),
      ...(learner.parentId ? [{ userId: learner.parentId, link: '/app/parent-portal-pathway' }] : []),
    ].filter((recipient, index, all) => all.findIndex((item) => item.userId === recipient.userId) === index);
    const copy = {
      RECOMMENDATION_READY: {
        title: 'Pathway recommendation ready',
        message: `The ${pathway.replace(/_/g, ' ')} recommendation is ready to review.`,
      },
      DECISION_FINALIZED: {
        title: 'Pathway decision finalized',
        message: `${pathway.replace(/_/g, ' ')} is now the finalized pathway decision.`,
      },
      DECISION_OVERRIDDEN: {
        title: 'Finalized pathway updated',
        message: `The finalized pathway decision was updated to ${pathway.replace(/_/g, ' ')}.`,
      },
    }[event];
    await Promise.allSettled(
      recipients.map((recipient) =>
        NotificationService.createNotification({
          userId: recipient.userId,
          title: copy.title,
          message: copy.message,
          type: NotificationType.INFO,
          link: recipient.link,
          metadata: { kind: 'PATHWAY', event, learnerId, pathway },
        })
      )
    );
  } catch {
    /* Recommendation persistence remains authoritative. */
  }
}

export const pathwayRecommendationController = {
  recommendForLearner: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const { term, academicYear, targetGradeLevel } = req.query as any;

    const result = await PathwayService.recommendSeniorPathway(learnerId, {
      term: term as any,
      academicYear: academicYear ? parseInt(String(academicYear)) : undefined,
      targetGradeLevel: (targetGradeLevel as any) || 'GRADE10',
    });

    res.json(result);
  },

  grade9TransitionReadiness: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const body = (req.body || {}) as any;

    const result = await PathwayService.analyzeReadiness(learnerId, {
      learnerInterest: body.learnerInterest,
      teacherRecommendation: body.teacherRecommendation,
      parentPreference: body.parentPreference,
      term: body.term,
      academicYear: body.academicYear,
    });

    res.json({ success: true, data: result });
  },

  saveTransitionDecision: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const body = (req.body || {}) as any;
    const role = String(req.user?.role || '');

    // Parents must use the dedicated /parent-preference endpoint
    if (role === 'PARENT') {
      throw new ApiError(403, 'Parents must use the /parent-preference endpoint');
    }

    const validPathways = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'];
    const recommendedPathway = body.recommendedPathway ? String(body.recommendedPathway).trim() : null;
    const finalApprovedPathway = body.finalApprovedPathway ? String(body.finalApprovedPathway).trim() : null;

    if (!finalApprovedPathway && !recommendedPathway) {
      throw new ApiError(400, 'recommendedPathway is required');
    }
    if (recommendedPathway && !validPathways.includes(recommendedPathway)) {
      throw new ApiError(422, `recommendedPathway must be one of: ${validPathways.join(', ')}`);
    }
    if (finalApprovedPathway && !validPathways.includes(finalApprovedPathway)) {
      throw new ApiError(422, `finalApprovedPathway must be one of: ${validPathways.join(', ')}`);
    }

    const canFinalize = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(role);
    if (finalApprovedPathway && !canFinalize) {
      throw new ApiError(403, 'Only Super Admin, Admin, or Head Teacher can finalize an approved pathway');
    }

    let row;
    if (finalApprovedPathway) {
      row = await PathwayService.finalizePathway(learnerId, {
        finalApprovedPathway: finalApprovedPathway as any,
        updatedBy: req.user?.userId,
      });
    } else {
      row = await PathwayService.submitRecommendation(learnerId, {
        recommendedPathway: recommendedPathway as any,
        confidenceScore: Number(body.confidenceScore || 0),
        learnerInterest: body.learnerInterest || null,
        teacherRecommendation: body.teacherRecommendation || null,
        mismatchWarning: body.mismatchWarning || null,
        analysisPayload: body.analysisPayload || null,
        updatedBy: req.user?.userId,
      });
    }

    await notifyPathwayUsers(
      learnerId,
      String(finalApprovedPathway || recommendedPathway),
      finalApprovedPathway ? 'DECISION_FINALIZED' : 'RECOMMENDATION_READY',
    );

    res.status(201).json({ success: true, data: row });
  },

  saveParentPreference: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const body = (req.body || {}) as any;
    const role = String(req.user?.role || '');

    if (!['PARENT', 'SUPER_ADMIN'].includes(role)) {
      throw new ApiError(403, 'This endpoint is for parent use only');
    }

    const VALID_PATHWAY_CODES = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS', ''];
    const raw = body.parentPreference === undefined ? undefined : String(body.parentPreference ?? '').trim();
    if (raw !== undefined && !VALID_PATHWAY_CODES.includes(raw)) {
      throw new ApiError(422, `parentPreference must be one of: STEM, SOCIAL_SCIENCES, ARTS_SPORTS, or empty`);
    }
    const parentPreference = raw === '' ? null : (raw ?? null);

    const row = await PathwayService.submitParentPreference(learnerId, {
      parentPreference: parentPreference as any,
      updatedBy: req.user?.userId,
    });

    res.status(201).json({ success: true, data: row });
  },

  overrideFinalizedDecision: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const body = (req.body || {}) as any;
    const role = String(req.user?.role || '');
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'];
    if (!allowedRoles.includes(role)) {
      throw new ApiError(403, 'Only Super Admin, Admin, or Head Teacher can override a finalized pathway');
    }

    const validPathways = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'];
    const finalApprovedPathway = String(body.finalApprovedPathway || '').trim();
    const reason = String(body.reason || '').trim();
    if (!validPathways.includes(finalApprovedPathway)) {
      throw new ApiError(422, `finalApprovedPathway must be one of: ${validPathways.join(', ')}`);
    }
    if (reason.length < 10) {
      throw new ApiError(422, 'reason must contain at least 10 characters');
    }
    if (!req.user?.userId) throw new ApiError(401, 'Authentication required');

    const row = await PathwayService.overrideFinalizedPathway(learnerId, {
      finalApprovedPathway: finalApprovedPathway as any,
      reason,
      updatedBy: req.user.userId,
    });
    await notifyPathwayUsers(learnerId, finalApprovedPathway, 'DECISION_OVERRIDDEN');
    res.status(201).json({ success: true, data: row });
  },

  getTransitionDecisionHistory: async (req: AuthRequest, res: Response) => {
    const { learnerId } = req.params;
    const history = await PathwayService.getDecisionHistory(learnerId);
    res.json({ success: true, data: history });
  },
};
