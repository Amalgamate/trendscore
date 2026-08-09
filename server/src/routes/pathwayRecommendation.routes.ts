import { Router } from 'express';
import { pathwayRecommendationController } from '../controllers/pathwayRecommendation.controller';
import { requireLearnerPathwayAccess } from '../middleware/pathwayAccess.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';
import { requirePermission, auditLog } from '../middleware/permissions.middleware';
import { requireLearnerPathwayStage } from '../middleware/pathwayStage.middleware';

const router = Router();

// GET /api/pathways/recommendations/:learnerId?term=TERM_1&academicYear=2026&targetGradeLevel=GRADE10
router.get('/recommendations/:learnerId', requireLearnerPathwayAccess, requireLearnerPathwayStage(['JUNIOR_TRANSITION']), pathwayRecommendationController.recommendForLearner);
router.post('/transition/:learnerId/readiness', requireLearnerPathwayAccess, requireLearnerPathwayStage(['JUNIOR_TRANSITION']), requireCsrf, pathwayRecommendationController.grade9TransitionReadiness);
router.post(
  '/transition/:learnerId/decision',
  requireLearnerPathwayAccess,
  requireLearnerPathwayStage(['JUNIOR_TRANSITION']),
  requireCsrf,
  requirePermission('COUNSEL_PATHWAY'),
  auditLog('SAVE_PATHWAY_TRANSITION_DECISION'),
  pathwayRecommendationController.saveTransitionDecision,
);
router.post(
  '/transition/:learnerId/parent-preference',
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('SAVE_PARENT_PATHWAY_PREFERENCE'),
  pathwayRecommendationController.saveParentPreference,
);
router.post(
  '/transition/:learnerId/decision/override',
  requireLearnerPathwayAccess,
  requireLearnerPathwayStage(['JUNIOR_TRANSITION']),
  requireCsrf,
  requirePermission('LOCK_PATHWAY'),
  auditLog('OVERRIDE_FINALIZED_PATHWAY_TRANSITION_DECISION'),
  pathwayRecommendationController.overrideFinalizedDecision,
);
router.get('/transition/:learnerId/decision-history', requireLearnerPathwayAccess, pathwayRecommendationController.getTransitionDecisionHistory);

export default router;
