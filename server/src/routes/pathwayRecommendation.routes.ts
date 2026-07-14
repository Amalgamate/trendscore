import { Router } from 'express';
import { pathwayRecommendationController } from '../controllers/pathwayRecommendation.controller';
import { requireLearnerPathwayAccess } from '../middleware/pathwayAccess.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';
import { auditLog } from '../middleware/permissions.middleware';
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
  auditLog('SAVE_PATHWAY_TRANSITION_DECISION'),
  pathwayRecommendationController.saveTransitionDecision,
);
router.get('/transition/:learnerId/decision-history', requireLearnerPathwayAccess, pathwayRecommendationController.getTransitionDecisionHistory);

export default router;
