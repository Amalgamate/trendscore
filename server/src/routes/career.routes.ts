/**
 * career.routes.ts
 * Routes for the Career Explorer module (SPEC-005).
 * Mount point: /api/careers  and  /api/learners (learner-scoped sub-routes)
 * Authentication is applied in index.ts before these routes.
 */

import { Router } from 'express';
import { careerController } from '../controllers/career.controller';
import { auditLog } from '../middleware/permissions.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';

const router = Router();

// ── Career catalogue ─────────────────────────────────────────────────────────
router.get('/',          careerController.listCareers);
router.get('/families',  careerController.listFamilies);
router.get('/compare',   careerController.compareCareers);
router.get('/:careerId', careerController.getCareer);

// ── Admin mutations ───────────────────────────────────────────────────────────
router.post('/',
  requireCsrf,
  auditLog('CREATE_CAREER'),
  careerController.createCareer
);

router.post('/seed',
  requireCsrf,
  auditLog('SEED_CAREER_CATALOGUE'),
  careerController.seedCareers
);

router.patch('/:careerId',
  requireCsrf,
  auditLog('UPDATE_CAREER'),
  careerController.updateCareer
);

router.post('/families',
  requireCsrf,
  auditLog('CREATE_CAREER_FAMILY'),
  careerController.createFamily
);

router.post('/:careerId/publish', requireCsrf, auditLog('PUBLISH_CAREER'), careerController.publishCareer);
router.post('/:careerId/retire', requireCsrf, auditLog('RETIRE_CAREER'), careerController.retireCareer);

export default router;

// ── Learner-scoped routes (exported separately for index.ts mounting) ─────────
export const learnerCareerRouter = Router({ mergeParams: true });

learnerCareerRouter.get('/career-matches',                    careerController.getLearnerMatches);
learnerCareerRouter.post('/career-matches/recalculate',       careerController.recalculateMatches);
learnerCareerRouter.get('/career-combination-impact',         careerController.getCombinationImpact);
learnerCareerRouter.get('/saved-careers',                     careerController.getSavedCareers);
learnerCareerRouter.post('/saved-careers', requireCsrf,       careerController.saveCareer);
learnerCareerRouter.patch('/saved-careers/:careerId', requireCsrf, careerController.updateSave);
learnerCareerRouter.delete('/saved-careers/:careerId', requireCsrf, careerController.removeCareer);
