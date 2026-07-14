import { Router } from 'express';
import { seniorPathwayController } from '../controllers/seniorPathway.controller';
import { auditLog, requirePermission } from '../middleware/permissions.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';
import {
  requireLearnerPathwayAccess,
  requirePathwaySelectionAccess,
} from '../middleware/pathwayAccess.middleware';
import {
  requireBodyLearnerPathwayStage,
  requireLearnerPathwayStage,
  requireSelectionPathwayStage,
} from '../middleware/pathwayStage.middleware';
import { requireInstitutionType } from '../middleware/requireInstitutionType.middleware';

const router = Router();

router.get('/catalog', seniorPathwayController.getCatalog);
router.get('/combinations', seniorPathwayController.getCombinations);
router.get('/offerings', requireInstitutionType('SECONDARY'), seniorPathwayController.getSchoolOfferings);
router.get('/school-offerings', requireInstitutionType('SECONDARY'), seniorPathwayController.getSchoolOfferings);
router.get('/learners/:learnerId/selection', requireLearnerPathwayAccess, requireLearnerPathwayStage(['SENIOR_EXECUTION']), seniorPathwayController.getLearnerSelection);
router.get('/learners/:learnerId/legacy-preview', requireLearnerPathwayAccess, requireLearnerPathwayStage(['SENIOR_EXECUTION']), seniorPathwayController.previewLegacySelection);
router.get('/learners/:learnerId/search-criteria', requireLearnerPathwayAccess, seniorPathwayController.getSearchCriteria);
router.put(
  '/learners/:learnerId/search-criteria',
  requireLearnerPathwayAccess,
  requireCsrf,
  auditLog('UPDATE_LEARNER_SCHOOL_SEARCH_CRITERIA'),
  seniorPathwayController.updateSearchCriteria,
);
router.get('/selections/:id/history', requirePathwaySelectionAccess, seniorPathwayController.getSelectionHistory);

router.post(
  '/seed',
  requireInstitutionType('SECONDARY'),
  requirePermission('MANAGE_PATHWAY_CATALOG'),
  requireCsrf,
  auditLog('SEED_SENIOR_PATHWAY_OFFICIAL_CATALOG'),
  seniorPathwayController.seedCatalog
);

router.post('/validate-selection', requireInstitutionType('SECONDARY'), seniorPathwayController.validateSelection);

router.put(
  '/offerings',
  requireInstitutionType('SECONDARY'),
  requirePermission('MANAGE_PATHWAY_OFFERINGS'),
  requireCsrf,
  auditLog('UPDATE_SENIOR_SCHOOL_OFFERINGS'),
  seniorPathwayController.updateSchoolOfferings
);

router.put(
  '/school-offerings',
  requireInstitutionType('SECONDARY'),
  requirePermission('MANAGE_PATHWAY_OFFERINGS'),
  requireCsrf,
  auditLog('UPDATE_SENIOR_SCHOOL_OFFERINGS'),
  seniorPathwayController.updateSchoolOfferings
);

router.post(
  '/selections',
  requireInstitutionType('SECONDARY'),
  requirePermission('COUNSEL_PATHWAY'),
  requireBodyLearnerPathwayStage(['SENIOR_EXECUTION']),
  requireCsrf,
  auditLog('SAVE_SENIOR_PATHWAY_SELECTION_DRAFT'),
  seniorPathwayController.saveSelection
);

router.post(
  '/selections/:id/submit',
  requireInstitutionType('SECONDARY'),
  requirePermission('COUNSEL_PATHWAY'),
  requireSelectionPathwayStage(['SENIOR_EXECUTION']),
  requireCsrf,
  auditLog('SUBMIT_SENIOR_PATHWAY_SELECTION'),
  seniorPathwayController.submitSelection
);

router.post(
  '/selections/:id/approve',
  requireInstitutionType('SECONDARY'),
  requirePermission('APPROVE_PATHWAY'),
  requireSelectionPathwayStage(['SENIOR_EXECUTION']),
  requireCsrf,
  auditLog('APPROVE_SENIOR_PATHWAY_SELECTION'),
  seniorPathwayController.approveSelection
);

router.post(
  '/selections/:id/request-revision',
  requireInstitutionType('SECONDARY'),
  requirePermission('APPROVE_PATHWAY'),
  requireSelectionPathwayStage(['SENIOR_EXECUTION']),
  requireCsrf,
  auditLog('REQUEST_SENIOR_PATHWAY_SELECTION_REVISION'),
  seniorPathwayController.requestRevision
);

router.post(
  '/selections/:id/lock',
  requireInstitutionType('SECONDARY'),
  requirePermission('LOCK_PATHWAY'),
  requireSelectionPathwayStage(['SENIOR_EXECUTION']),
  requireCsrf,
  auditLog('LOCK_SENIOR_PATHWAY_SELECTION'),
  seniorPathwayController.lockSelection
);

export default router;
